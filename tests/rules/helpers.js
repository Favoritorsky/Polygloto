// Общая инициализация тестового окружения правил (эмулятор Firestore + Storage).
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-polygloto-rules';

export async function createEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
}

/** Контекст пользователя. verified — email_verified в токене. */
export function as(env, uid, { verified = false } = {}) {
  return env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();
}

export function anon(env) {
  return env.unauthenticatedContext().firestore();
}

/** Записывает данные в обход правил (как это делают Cloud Functions). */
export async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

export function userProfile(overrides = {}) {
  return {
    displayName: 'Тестовый автор',
    photoURL: null,
    bio: '',
    role: 'reader',
    banned: false,
    commentsCount: 0,
    createdAt: Timestamp.now(),
    ...overrides,
  };
}
