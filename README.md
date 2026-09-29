# Polygloto

Веб-платформа, где авторы создают интерактивные самоучители языков (в том числе
конлангов) прямо в браузере: уроки со встроенными заданиями, справочник и словарь.

Стек: React 19 + Vite, React Router, CSS Modules, Firebase (Cloud Firestore,
Authentication, Cloud Functions v2, Storage), редактор на Slate.

## Структура

```
docs/data-model.md    — схема всех коллекций Firestore (источник правды)
shared/schema.js      — константы схемы (коллекции, статусы, лимиты) для клиента и функций
src/services/         — весь доступ к Firebase (компоненты не вызывают SDK напрямую)
src/components/       — React-компоненты (каждый со своим *.module.css)
src/pages/            — страницы (маршруты)
functions/            — Cloud Functions, по файлу на функцию, экспорт из index.js
firestore.rules       — Security Rules Firestore
storage.rules         — Security Rules Storage
tests/rules/          — тесты правил (эмулятор)
tests/functions/      — интеграционные тесты функций (эмулятор)
tests/e2e/            — сквозные сценарии в браузере (Playwright), по файлу на этап
docs/security.md      — модель угроз, итоговый аудит и чек-лист перед запуском
docs/stage-reports.md — отчёты по этапам разработки
```

## Локальный запуск с эмуляторами (рекомендуется для разработки)

Нужны Node 22 и Java 17+ (для эмулятора Firestore).

```bash
npm install
npm --prefix functions install
npm install -g firebase-tools
npm run emulators      # Auth, Firestore, Functions, Storage
npm run dev:emu        # в другом терминале; фронтенд на http://localhost:5173
```

Письма подтверждения и сброса пароля в эмуляторе не отправляются: ссылки
печатаются в логе эмулятора Auth.

## Подключение боевого проекта Firebase

1. `cp .env.example .env.local` и заполните `VITE_FIREBASE_*` из консоли Firebase
   (Project settings → Your apps → Web app). Файл `.env.local` не коммитится.
2. В `.firebaserc` замените `demo-polygloto` на ID вашего проекта (или `firebase use --add`).
3. В консоли включите: Authentication → Email/Password; Firestore (Native mode); Storage.
   Cloud Functions требуют тарифа Blaze.
4. `firebase deploy` — правила, индексы, функции и хостинг.
5. Пройдите чек-лист «Перед запуском» в [docs/security.md](docs/security.md)
   (App Check, защита от перебора email, ограничения API-ключа, бюджет).

## Как назначить администратора

Роль `admin` выдаётся только вручную: Firebase Console → Firestore →
`users/{uid}` → поле `role` → `"admin"`. Клиент изменить роль не может
(это проверяют тесты правил).

## Тесты

```bash
npm test                 # юнит-тесты логики
npm run test:rules       # Security Rules (эмулятор Firestore + Storage)
npm run test:functions   # Cloud Functions (эмуляторы Auth + Firestore + Functions)
npm run test:e2e         # браузерные сценарии: нужны запущенные `npm run emulators` и `npm run dev:emu`
npm run lint
```

Если Chromium для Playwright установлен не в стандартное место:
`CHROMIUM_PATH=/путь/к/chromium npm run test:e2e`.
