# Модель данных Polygloto (Cloud Firestore)

Это единственный документ, описывающий все коллекции и формы документов.
Константы (имена коллекций, перечисления, лимиты длины) продублированы в коде в
[`shared/schema.js`](../shared/schema.js), а лимиты — в [`firestore.rules`](../firestore.rules).
Если меняете поле здесь, меняйте его во всех трёх местах.

Условные обозначения:
- **server-only** — поле пишет только Cloud Function (Admin SDK) или админ через консоль; правила запрещают клиенту его создавать/менять.
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

publicCourses/{courseId}      ← опубликованный снимок. Пишет только Cloud Function moderateCourse.
  lessons/{lessonId}            Читают все.
  reference/{sectionId}
  dictionary/{wordId}

catalogMeta/languages         ← список языков для фильтра каталога (пишет триггер)
```

Когда админ одобряет курс, функция `moderateCourse` копирует рабочую версию
(`courses/{id}` + подколлекции контента) в `publicCourses/{id}`, полностью
заменяя прежний снимок. Пока новая версия на модерации, читатели видят старый
снимок — рабочие правки автора их не затрагивают. Так выполняется требование
«черновик и опубликованная версия — физически разные документы» (в спецификации
предлагалось поле `publishedSnapshot`; отдельная коллекция выбрана потому, что
контент курса живёт в подколлекциях, а в одно поле документа (лимит 1 МиБ) весь
курс не поместится).

Комментарии, реакции и оценки лежат под `courses/{id}` (как в спецификации),
но правила разрешают доступ к ним только если существует `publicCourses/{id}`.

---

## `users/{uid}`

Создаётся Cloud Function `onUserCreated` (триггер Auth) при регистрации.
Читается всеми (публичный профиль; email здесь **не** хранится).

| Поле | Тип | Кто пишет | Описание |
|---|---|---|---|
| `displayName` | string, 2–40 | владелец | Отображаемое имя |
| `photoURL` | string ≤1024 \| null | владелец | URL аватара только из своей папки Storage `avatars/{uid}/` |
| `bio` | string ≤500 | владелец | «О себе» |
| `role` | `"reader"` \| `"user"` \| `"admin"` | **server-only** | `reader` при регистрации; `user` выставляет callable `syncRole` после подтверждения email; `admin` — только вручную в консоли Firebase |
| `banned` | bool | **server-only** | Бан (callable `setUserBan`, только админ). Забаненный не может ничего писать |
| `commentsCount` | number | **server-only** | Счётчик комментариев (для бейджа активности) |
| `createdAt` | timestamp | **server-only** | |

Статус подтверждения почты **не хранится** в базе: правила и функции берут его
из `request.auth.token.email_verified` / `context.auth.token.email_verified`.

Роль `user` — это отражение факта подтверждения почты для UI и профиля.
Правила, где важно подтверждение (отправка на модерацию), проверяют сам токен,
а не роль.

## `courses/{courseId}` — рабочая версия курса

Создаётся **только** callable `createCourse` (rate limit: 1 курс в 30 с).
Читают и пишут: автор (`authorId == request.auth.uid`) и админ.
Удалить может автор или админ (триггер `onCourseDeleted` удаляет подколлекции
и опубликованную копию).

| Поле | Тип | Кто пишет | Описание |
|---|---|---|---|
| `authorId` | string (uid) | **server-only** (неизменяемо) | Автор |
| `title` | string 3–120 | автор | Название |
| `language` | string 2–60 | автор | Изучаемый язык (поиск/фильтр) |
| `description` | string ≤2000 | автор | Описание |
| `categories` | array ≤20 of `{ id: string, name: string ≤40, color: "#rrggbb" }` | автор | Пользовательские категории разметки текста (фонетика, части речи…) с цветом подчёркивания |
| `lessonOrder` | array of lessonId | автор | Порядок уроков |
| `referenceOrder` | array of sectionId | автор | Порядок разделов справочника |
| `status` | `"draft"` \| `"pending_review"` \| `"published"` \| `"rejected"` | автор — только разрешённые переходы, см. ниже | Статус **рабочей** версии |
| `rejectionReason` | string \| null | **server-only** | Причина отклонения |
| `hasPublishedVersion` | bool | **server-only** | Есть ли снимок в `publicCourses` |
| `submittedAt` | timestamp \| null | автор (вместе с переходом в `pending_review`) | |
| `createdAt` | timestamp | **server-only** | |
| `updatedAt` | timestamp | автор (`== request.time`) | |

### Статусы и переходы

| Из \ В | draft | pending_review | published | rejected |
|---|---|---|---|---|
| draft | — | автор (нужен `email_verified`) | — | — |
| pending_review | автор (отозвать) | — | админ (функция) | админ (функция, причина обязательна) |
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

Создаётся **только** callable `addComment` (rate limit: 1 комментарий в 15 с).
Читают все, если курс опубликован. Удалить может автор комментария, автор курса или админ.

| Поле | Тип | Описание |
|---|---|---|
| `authorId` | string | |
| `authorName` | string | Снимок displayName на момент написания |
| `authorPhotoURL` | string \| null | |
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

Триггер `onRatingWritten` пересчитывает `publicCourses/{id}.likesCount/dislikesCount`
агрегирующим `count()`-запросом по подколлекции (клиент счётчики не трогает).

## `publicCourses/{courseId}` — опубликованный снимок

Пишет **только** Cloud Functions. Читают все.

| Поле | Тип | Описание |
|---|---|---|
| `authorId` | string | |
| `authorName` | string | Снимок имени автора на момент публикации |
| `title`, `language`, `description`, `categories`, `lessonOrder`, `referenceOrder` | как в `courses` | Снимок одобренной версии |
| `titleLower`, `languageLower` | string | `normalizeText(...)` — фильтр по языку |
| `searchKeywords` | array of string | Префиксы слов названия и языка (`buildSearchKeywords`) для поиска |
| `likesCount`, `dislikesCount` | number | Денормализованные агрегаты (пишет `onRatingWritten`) |
| `score` | number | `likesCount − dislikesCount` — сортировка «по рейтингу» |
| `commentsCount` | number | Счётчик комментариев (пишут `addComment` / `onCommentDeleted`) |
| `toc` | map | `{ lessons: [{id, title}], reference: [{id, title}] }` — оглавление без загрузки разделов |
| `lessonsCount`, `wordsCount` | number | Для витрины |
| `publishedAt` | timestamp | Первая публикация |
| `updatedAt` | timestamp | Последнее одобрение |

Подколлекции `lessons`, `reference`, `dictionary` — копии рабочих, те же поля.

### Запросы каталога

Поиск: `searchKeywords array-contains <самое длинное слово запроса>`, остальные
слова проверяются на клиенте по тому же полю (`src/catalog/catalogQuery.js`).
Фильтр по языку: `languageLower == …`. Сортировка: `score desc`,
`likesCount desc`, `dislikesCount asc`, `publishedAt desc`. Все сочетания
покрыты составными индексами в `firestore.indexes.json` (эмулятор индексы не
требует, продакшен — требует).

## `catalogMeta/languages`

Список языков опубликованных курсов для фильтра каталога. Пишет только
триггер `onPublicCourseWritten` (пересчёт `count()` по затронутым языкам),
читают все.
`{ items: [{ key: languageLower, name: language, count }] }`, отсортировано по названию.

## `rateLimits/{uid}`

Служебная коллекция; клиенту закрыта полностью.
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

## Firebase Storage

`avatars/{uid}/{fileName}` — аватар. Читают все; создаёт, заменяет и удаляет
только владелец. Правила (`storage.rules`): имя файла `[A-Za-z0-9_-]{1,64}.(jpg|jpeg|png|webp)`,
тип `image/jpeg|png|webp` (SVG запрещён: он может содержать скрипты), размер
от 1 байта до 2 МиБ. Клиент обрезает картинку до квадрата 256×256 и
сохраняет JPEG (`src/services/avatarService.js`), старый файл удаляет после
успешной смены. `users.photoURL` правила принимают только ссылкой на файл из
собственной папки `avatars/{uid}/`. При удалении аккаунта `onUserDeleted`
стирает папку.
Зарезервировано для v2: `audio/{courseId}/…`.
