/**
 * Инициализация Firebase. Единственное место, где создаются экземпляры SDK.
 * Конфиг берётся из переменных окружения VITE_FIREBASE_* (.env.local),
 * ключи в коде не хранятся.
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

/** true, если конфиг заполнен; иначе приложение показывает экран настройки. */
export const isFirebaseConfigured = missing.length === 0;
export const missingConfigKeys = missing;

const useEmulators = env.VITE_USE_EMULATORS === 'true';

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app
  ? initializeFirestore(app, {
      // Офлайн-кэш: правки черновика не теряются при кратковременной потере сети.
      localCache: useEmulators
        ? undefined
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null;

if (app && useEmulators) {
  const host = env.VITE_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
