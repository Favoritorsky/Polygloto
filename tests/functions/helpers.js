// Общие помощники интеграционных тестов Cloud Functions (эмуляторы Auth + Firestore + Functions).
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { getApps as getAdminApps, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { FUNCTIONS_REGION } from '../../shared/schema.js';

export const PROJECT_ID = 'demo-polygloto';
const HOST = '127.0.0.1';

process.env.FIRESTORE_EMULATOR_HOST ??= `${HOST}:8080`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${HOST}:9099`;

const adminApp = getAdminApps()[0] ?? initAdmin({ projectId: PROJECT_ID });
export const adminDb = getAdminFirestore(adminApp);
export const adminAuth = getAdminAuth(adminApp);

let counter = 0;

/** Клиент Firebase от имени отдельного пользователя (своё приложение на каждого). */
export function createClient() {
  counter += 1;
  const app = initializeApp(
    { apiKey: 'demo-key', projectId: PROJECT_ID, authDomain: `${PROJECT_ID}.firebaseapp.com` },
    `client-${counter}-${Date.now()}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  connectFunctionsEmulator(functions, HOST, 5001);
  return {
    app,
    auth,
    db,
    call: (name, data) => httpsCallable(functions, name)(data).then((r) => r.data),
    async close() {
      await signOut(auth).catch(() => {});
      await deleteApp(app);
    },
  };
}

export function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Ждёт выполнения условия (триггеры в эмуляторе асинхронны). */
export async function waitFor(check, { timeout = 15000, interval = 200 } = {}) {
  const started = Date.now();
  for (;;) {
    const result = await check();
    if (result) return result;
    if (Date.now() - started > timeout) throw new Error('waitFor: timeout');
    await new Promise((r) => setTimeout(r, interval));
  }
}

/** Регистрирует пользователя и ждёт, пока триггер создаст users/{uid}. */
export async function signUp(client, { verified = false, role } = {}) {
  const email = uniqueEmail();
  const { user } = await createUserWithEmailAndPassword(client.auth, email, 'password123');
  await waitFor(async () => (await adminDb.doc(`users/${user.uid}`).get()).exists);
  if (verified) {
    await adminAuth.updateUser(user.uid, { emailVerified: true });
    await user.getIdToken(true);
  }
  if (role) await adminDb.doc(`users/${user.uid}`).update({ role });
  return user;
}
