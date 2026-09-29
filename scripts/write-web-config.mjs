// CI: получает веб-конфиг Firebase (`firebase apps:sdkconfig web --json`, stdin)
// и записывает его в .env.production.local для сборки Vite.
// Конфиг веб-приложения не секретный (он всё равно попадает в бандл),
// но в репозиторий его не кладём: он берётся из проекта при каждом деплое.
import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync(0, 'utf8');
const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
const result = parsed.result ?? parsed;
const config = result.sdkConfig ?? JSON.parse(String(result.fileContents).match(/\{[\s\S]*\}/)[0]);

const env = {
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: config.storageBucket ?? '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: config.messagingSenderId,
  VITE_FIREBASE_APP_ID: config.appId,
  VITE_USE_EMULATORS: 'false',
};
const missing = Object.entries(env).filter(([k, v]) => !v && k !== 'VITE_FIREBASE_STORAGE_BUCKET').map(([k]) => k);
if (missing.length) throw new Error(`В конфиге Firebase нет полей: ${missing.join(', ')}`);
writeFileSync('.env.production.local', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
console.log(`Веб-конфиг проекта ${config.projectId} записан в .env.production.local`);
