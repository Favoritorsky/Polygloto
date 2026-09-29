# Модель данных Polygloto (Cloud Firestore)

Это единственный документ, описывающий все коллекции и формы документов.
Константы (имена коллекций, перечисления, лимиты длины) продублированы в коде в
[`shared/schema.js`](../shared/schema.js), а лимиты — в [`firestore.rules`](../firestore.rules).
Если меняете поле здесь, меняйте его во всех трёх местах.

Условные обозначения:
- **protected** — клиент задаёт поле только при создании документа или в строго описанном переходе, который проверяют правила; менять его иначе нельзя.

Серверного кода нет (тариф Spark, без Cloud Functions): все записи делает
клиент, а согласованность нескольких документов обеспечивают пакеты,
транзакции и правила с `getAfter()`/`existsAfter()` — правило смотрит, каким
будет соседний документ после той же записи.
- `timestamp` — `serverTimestamp()`; правила требуют `== request.time`, где клиент пишет это поле.

## Общая идея: рабочая и опубликованная версия физически разделены

```
courses/{courseId}            ← рабочая версия (черновик). Читает/пишет только автор и админ.
  lessons/{lessonId}
  reference/{sectionId}
  dictionary/{wordId}
  comments/{commentId}        ← публичные обсуждения опубликованного курса
  reactions/{reactionId}      ← эмодзи-реакции на уроки/комментарии
  ratings/{uid}               ← лайк/дизлайк курса

publicCourses/{courseId}      ← опубликованный снимок. Пишет браузер админа при одобрении.
  lessons/{lessonId}            Читают все.
  reference/{sectionId}
  dictionary/{wordId}

catalogMeta/languages         ← список языков для фильтра каталога (пишет админ при публикации)
```

Когда админ одобряет курс, его браузер (`approveCourse` в
`src/services/moderationService.js`) собирает снимок функцией
`shared/publicSnapshot.js` (очистка контента от лишних полей), пакетами по 400
записей заменяет подколлекции `publicCourses/{id}`, а затем одной транзакцией
записывает сам `publicCourses/{id}` (с `approvedAt == request.time`), переводит
курс в `published` и обновляет `catalogMeta/languages`. Правила разрешают
переход курса в `published` только админу и только если в той же записи
появляется свежий `approvedAt`. Пока новая версия на модерации, читатели видят старый
снимок — рабочие правки автора их не затрагивают. Так выполняется требование
«черновик и опубликованная версия — физически разные документы» (в спецификации
предлагалось поле `publishedSnapshot`; отдельная коллекция выбрана потому, что
контент курса живёт в подколлекциях, а в одно поле документа (лимит 1 МиБ) весь
курс не поместится).

Комментарии, реакции и оценки лежат под `courses/{id}` (как в спецификации),
но правила разрешают доступ к ним только если существует `publicCourses/{id}`.

---

## `users/{uid}`

Создаёт сам клиент сразу после регистрации (`createOwnProfile`; если запись не
удалась, `AuthProvider` повторит её при следующем входе). Правила разрешают
создать только свой документ с ровно этими полями, `role: "reader"` (или
`"user"`, если в токене уже `email_verified`), `banned: false` и
`createdAt == request.time`.
Читается всеми (публичный профиль; email здесь **не** хранится).

| Поле | Тип | Кто пишет | Описание |
|---|---|---|---|
| `displayName` | string, 2–40 | владелец | Отображаемое имя |
| `photoURL` | string ≤40000 \| null | владелец | Аватар как data URL `data:image/jpeg;base64,…` (Storage на Spark недоступен). Клиент ужимает картинку до 160×160 JPEG |
| `bio` | string ≤500 | владелец | «О себе» |
| `role` | `"reader"` \| `"user"` \| `"admin"` | **protected** | `reader` при регистрации; сам владелец может сменить `reader → user`, только если в токене `email_verified == true`; `admin` — только вручную в консоли Firebase |
| `banned` | bool | **protected** | Бан. Меняет только админ (только это поле, не себе и не другому админу). Забаненный не может ничего писать |
| `createdAt` | timestamp | **protected** (`== request.time` при создании) | |

Число комментариев пользователя (бейдж активности) не хранится: его считает
агрегирующий `count()`-запрос по группе коллекций `comments` (`authorId == uid`).

Статус подтверждения почты **не хранится** в базе: правила берут его
из `request.auth.token.email_verified`.

Роль `user` — это отражение факта подтверждения почты для UI и профиля.
Правила, где важно подтверждение (отправка на модерацию), проверяют сам токен,
а не роль.

## `courses/{courseId}` — рабочая версия курса

Создаёт автор одним пакетом: курс (`status: "draft"`, пустые категории,
не больше одного урока в `lessonOrder`), первый урок и отметку в `rateLimits`
(не чаще 1 курса в 30 с — правило требует, чтобы отметка в той же записи
была равна `request.time`). Нужна роль `user` или `admin`.
Читают и пишут: автор (`authorId == request.auth.uid`) и админ.
Удалить может автор или админ. Каскад выполняет клиент (`deleteCourse`):
комментарии → реакции → подколлекции снимка → снимок → уроки, справочник,
словарь → сам курс. Оценки (`ratings`) приватны и остаются «сиротами»,
на работу сайта это не влияет.

| Поле | Тип | Кто пишет | Описание |
|---|---|---|---|
| `authorId` | string (uid) | **protected** (неизменяемо) | Автор |
| `title` | string 3–120 | автор | Название |
| `language` | string 2–60 | автор | Изучаемый язык (поиск/фильтр) |
| `description` | string ≤2000 | автор | Описание |
| `categories` | array ≤20 of `{ id: string, name: string ≤40, color: "#rrggbb" }` | автор | Пользовательские категории разметки текста (фонетика, части речи…) с цветом подчёркивания |
| `lessonOrder` | array of lessonId | автор | Порядок уроков |
| `referenceOrder` | array of sectionId | автор | Порядок разделов справочника |
| `status` | `"draft"` \| `"pending_review"` \| `"published"` \| `"rejected"` | автор — только разрешённые переходы, см. ниже | Статус **рабочей** версии |
| `rejectionReason` | string \| null | **protected** (админ при отклонении, 5–2000 символов) | Причина отклонения |
| `hasPublishedVersion` | bool | **protected** (админ при одобрении) | Есть ли снимок в `publicCourses` |
| `submittedAt` | timestamp \| null | автор (вместе с переходом в `pending_review`) | |
| `createdAt` | timestamp | **protected** (`== request.time`) | |
| `updatedAt` | timestamp | автор (`== request.time`) | |

### Статусы и переходы

| Из \ В | draft | pending_review | published | rejected |
|---|---|---|---|---|
| draft | — | автор (нужен `email_verified`) | — | — |
| pending_review | автор (отозвать) | — | админ (нужен свежий снимок) | админ (причина обязательна) |
| published | автор (начать правки) | — | — | — |
| rejected | автор (начать исправления) | — | — | — |

Контент (сам документ курса кроме статуса, уроки, справочник, словарь) автор
может менять **только в статусе `draft`**. Редактор при первой правке
опубликованного/отклонённого курса переводит его в `draft`. Благодаря этому
админ одобряет ровно ту версию, которую видел: в `pending_review` контент
заморожен.

Параметры `likesCount`/`dislikesCount` хранятся в `publicCourses` (там по ним
сортирует каталог), в рабочей версии их нет.

### `courses/{courseId}/lessons/{lessonId}` и `…/reference/{sectionId}`

| Поле | Тип | Описание |
|---|---|---|
| `title` | string ≤120 | Название урока/раздела |
| `blocks` | array ≤400 of Block | Структурированный контент (см. ниже) |
| `updatedAt` | timestamp | |

### `courses/{courseId}/dictionary/{wordId}`

| Поле | Тип | Описание |
|---|---|---|
| `word` | string 1–100 | Слово |
| `wordLower` | string | `normalizeText(word)` — для поиска и автоссылок; правила проверяют длину, клиент вычисляет |
| `translation` | string 1–300 | Перевод |
| `partOfSpeech` | одно из `PART_OF_SPEECH_IDS` | Часть речи |
| `examples` | array ≤10 of string ≤300 | Примеры употребления |
| `notes` | string ≤1000 | Заметки |
| `createdAt`, `updatedAt` | timestamp | |

### `courses/{courseId}/comments/{commentId}`

Создаёт пользователь одним пакетом вместе с отметкой в `rateLimits`
(не чаще 1 комментария в 15 с). Правила требуют `authorName` равным текущему
`users/{uid}.displayName`, непустой текст без пробелов по краям,
`createdAt == request.time` и незабаненного автора. Изменять комментарии нельзя.
Читают все, если курс опубликован. Удалить может автор комментария, автор курса или админ.

| Поле | Тип | Описание |
|---|---|---|
| `authorId` | string | |
| `authorName` | string | Снимок displayName на момент написания |
| `text` | string 1–2000 | Простой текст (рендерится как текст, не HTML) |
| `createdAt` | timestamp | |

### `courses/{courseId}/reactions/{uid}_{targetType}_{targetId}`

Одна эмодзи-реакция пользователя на один урок или комментарий (можно поменять/снять).
ID документа детерминирован — это и есть «один голос на цель».

| Поле | Тип | Описание |
|---|---|---|
| `uid` | string | `== request.auth.uid` |
| `targetType` | `"lesson"` \| `"comment"` | |
| `targetId` | string | ID урока или комментария |
| `emoji` | один из `REACTION_EMOJIS` | |
| `createdAt` | timestamp | |

### `courses/{courseId}/ratings/{uid}`

| Поле | Тип | Описание |
|---|---|---|
| `value` | `"like"` \| `"dislike"` | Один голос на пользователя, можно менять или удалить |
| `updatedAt` | timestamp | |

Голос и счётчики `publicCourses/{id}.likesCount/dislikesCount/score` клиент
меняет в одной транзакции (`setMyRating`, `increment`). Правило оценки
(`countersMatch`) сверяет прежний голос с новым и требует, чтобы счётчики в
той же записи изменились ровно на эту разницу, а `score` остался равен
`likesCount − dislikesCount`. Голосовать за свой курс нельзя.

## `publicCourses/{courseId}` — опубликованный снимок

Читают все. Пишут:
- админ — снимок целиком при одобрении;
- любой пользователь — только `likesCount`/`dislikesCount`/`score`, и только если в той же записи меняется его собственная оценка;
- автор — только `authorName`, и только равным своему новому `displayName` (синхронизация при смене имени).

Удалить может автор или админ.

| Поле | Тип | Описание |
|---|---|---|
| `authorId` | string | |
| `authorName` | string | Имя автора (обновляется при смене имени в профиле) |
| `title`, `language`, `description`, `categories`, `lessonOrder`, `referenceOrder` | как в `courses` | Снимок одобренной версии |
| `titleLower`, `languageLower` | string | `normalizeText(...)` — фильтр по языку |
| `searchKeywords` | array of string | Префиксы слов названия и языка (`buildSearchKeywords`) для поиска |
| `likesCount`, `dislikesCount` | number | Денормализованные агрегаты (транзакция голосования) |
| `score` | number | `likesCount − dislikesCount` — сортировка «по рейтингу» |
| `toc` | map | `{ lessons: [{id, title}], reference: [{id, title}] }` — оглавление без загрузки разделов |
| `lessonsCount`, `wordsCount` | number | Для витрины |
| `publishedAt` | timestamp | Первая публикация |
| `updatedAt` | timestamp | Последнее одобрение |
| `approvedBy` | string (uid) | Кто одобрил |
| `approvedAt` | timestamp | Время последнего одобрения; правила сверяют его с `request.time` при переходе курса в `published` |

Число комментариев не хранится: страница курса считает его запросом `count()`.

Подколлекции `lessons`, `reference`, `dictionary` — копии рабочих, те же поля.

### Запросы каталога

Поиск: `searchKeywords array-contains <самое длинное слово запроса>`, остальные
слова проверяются на клиенте по тому же полю (`src/catalog/catalogQuery.js`).
Фильтр по языку: `languageLower == …`. Сортировка: `score desc`,
`likesCount desc`, `dislikesCount asc`, `publishedAt desc`. Все сочетания
покрыты составными индексами в `firestore.indexes.json` (эмулятор индексы не
требует, продакшен — требует).

## `catalogMeta/languages`

Список языков опубликованных курсов для фильтра каталога. Пишет только админ:
при одобрении его браузер пересчитывает `count()` по языку курса. Читают все.
Если автор удалит опубликованный курс, счётчик языка обновится при следующем
одобрении курса на том же языке.
`{ items: [{ key: languageLower, name: language, count }] }`, отсортировано по названию.

## `rateLimits/{uid}`

Отметки времени для ограничения частоты. Читает и пишет только владелец,
удалять нельзя. Поле можно установить только в `request.time` и только если
прежнее значение старше лимита (`createCourse` — 30 с, `addComment` — 15 с).
Правила создания курса и комментария требуют, чтобы отметка менялась в той же
записи, поэтому обойти лимит, не трогая `rateLimits`, нельзя.
`{ createCourse: timestamp, addComment: timestamp }`

---

## Формат контента: Block

Контент уроков и справочника — массив блоков. Это **не HTML**: всё оформление
хранится атрибутами объектов, текст не содержит спецсимволов разметки.
Рендер — собственными React-компонентами (`src/components/content/`), без
`dangerouslySetInnerHTML`.

Firestore не поддерживает вложенные массивы, поэтому строки таблицы — объекты `{ cells: [...] }`.

```jsonc
// Абзац / заголовок
{ "type": "paragraph", "children": [Leaf, ...] }
{ "type": "heading", "level": 2 | 3, "children": [Leaf, ...] }

// Leaf — фрагмент текста с атрибутами
{
  "text": "ihura",
  "bold": true,            // опционально
  "italic": true,          // опционально
  "underline": true,       // опционально
  "color": "#e63946",      // опционально, из палитры PALETTE
  "category": "cat_ab12",  // опционально, id из courses.categories
  "dictRef": "wordId"      // опционально, ручная привязка к статье словаря
}

// Таблица
{ "type": "table", "rows": [ { "cells": ["Слово", "Перевод"] }, { "cells": ["ihura", "язык"] } ] }

// Задание (см. реестр src/tasks/taskTypeRegistry.js)
{ "type": "task", "taskType": "multiple_choice", "data": { ... } }

// Зарезервировано для v2 (рендерятся заглушкой):
{ "type": "audio", ... }
{ "type": "gloss", ... }
```

### Данные заданий (`task.data`)

| `taskType` | `data` |
|---|---|
| `multiple_choice` | `{ question: string, options: [{ id, text }], correctOptionId: string }` |
| `fill_blank` | `{ before: string, after: string, answers: string[] }` — текст с пропуском между `before` и `after` |
| `matching` | `{ instruction: string, pairs: [{ id, left, right }] }` |
| `translation` | `{ source: string, answers: string[] }` — первый ответ основной, остальные — допустимые варианты |
| `free_input` | `{ question: string, answers: string[] }` |

Проверка ответов нечувствительна к регистру и лишним пробелам (`normalizeText`).
Ответы проверяются на клиенте: задания — учебные, результат нигде не
засчитывается, поэтому доверять клиенту здесь безопасно.

## Файлы

Firebase Storage не используется: на тарифе Spark новые бакеты недоступны.
Аватар хранится прямо в `users/{uid}.photoURL` как data URL (160×160 JPEG,
не больше 40 000 символов; правила принимают только `data:image/jpeg;base64,`).
Клиент подбирает качество сжатия так, чтобы уложиться в лимит
(`src/services/avatarService.js`).
