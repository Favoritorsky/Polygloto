# Polygloto

Веб-платформа, где авторы создают интерактивные самоучители языков (в том числе
конлангов) прямо в браузере: уроки со встроенными заданиями, справочник и словарь.

Стек: React 19 + Vite, React Router, CSS Modules, Firebase (Cloud Firestore,
Authentication), редактор на Slate.

Проект рассчитан на **бесплатный тариф Spark**: Cloud Functions и Cloud Storage
не используются. Всё, что обычно делает сервер (защита ролей, переходы статусов
модерации, счётчики лайков, ограничение частоты), проверяют Firestore Security
Rules, а записи выполняет клиент пакетами и транзакциями. Подробности —
в [docs/security.md](docs/security.md).

## Структура

```
docs/data-model.md    — схема всех коллекций Firestore (источник правды)
shared/schema.js      — константы схемы (коллекции, статусы, лимиты)
shared/publicSnapshot.js — сборка публичного снимка курса при публикации
src/services/         — весь доступ к Firebase (компоненты не вызывают SDK напрямую)
src/components/       — React-компоненты (каждый со своим *.module.css)
src/pages/            — страницы (маршруты)
firestore.rules       — Security Rules Firestore (единственная серверная защита)
tests/rules/          — тесты правил (эмулятор)
tests/e2e/            — сквозные сценарии в браузере (Playwright), по файлу на этап
docs/security.md      — модель угроз, остаточные риски и чек-лист перед запуском
docs/stage-reports.md — отчёты по этапам разработки
```

## Локальный запуск с эмуляторами (рекомендуется для разработки)

Нужны Node 22 и Java 17+ (для эмулятора Firestore).

```bash
npm install
npm install -g firebase-tools
npm run emulators      # Auth + Firestore (проект demo-polygloto)
npm run dev:emu        # в другом терминале; фронтенд на http://localhost:5173
```

Письма подтверждения и сброса пароля в эмуляторе не отправляются: ссылки
печатаются в логе эмулятора Auth.

## Подключение боевого проекта Firebase (тариф Spark)

1. `cp .env.example .env.local` и заполните `VITE_FIREBASE_*` из консоли Firebase
   (Project settings → Your apps → Web app). Файл `.env.local` не коммитится.
2. `.firebaserc` уже указывает на проект `selfi-a04df` (для другого проекта:
   `firebase use --add`).
3. В консоли Firebase включите:
   - Authentication → Sign-in method → Email/Password;
   - Firestore Database → Create database (Native mode, регион по вкусу).
   Storage, Functions и Realtime Database не нужны.
4. `firebase login`, затем
   `firebase deploy --only firestore:rules,firestore:indexes,hosting`
   (перед деплоем хостинга выполните `npm run build`).
5. Добавьте домен хостинга в Authentication → Settings → Authorized domains,
   если его там нет.
6. Пройдите чек-лист «Перед запуском» в [docs/security.md](docs/security.md).

## Как назначить администратора

Роль `admin` выдаётся только вручную: зарегистрируйтесь на сайте, затем
Firebase Console → Firestore → `users/{uid}` → поле `role` → `"admin"`.
Клиент изменить роль на admin не может (это проверяют тесты правил).
Админ публикует курсы из своего браузера, поэтому давайте роль только
доверенным людям.

## Тесты

```bash
npm test                 # юнит-тесты логики
npm run test:rules       # Security Rules (сам поднимает эмулятор Firestore)
npm run test:e2e         # браузерные сценарии: нужны запущенные `npm run emulators` и `npm run dev:emu`
npm run lint
```

Если Chromium для Playwright установлен не в стандартное место:
`CHROMIUM_PATH=/путь/к/chromium npm run test:e2e`.
