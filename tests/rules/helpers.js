// Общая инициализация тестового окружения правил (эмулятор Firestore).
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export const PROJECT_ID = 'demo-polygloto-rules';

export async function createEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
}

/** Контекст пользователя. verified — email_verified в токене. */
export function as(env, uid, { verified = false } = {}) {
  return env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: verified }).firestore();
}

export function anon(env) {
  return env.unauthenticatedContext().firestore();
}

/** Записывает данные в обход правил (как админ через консоль или сид). */
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
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

/** Рабочая версия курса со значениями по умолчанию. */
export function course(overrides = {}) {
  return {
    authorId: 'alice',
    title: 'Токипона за 10 уроков',
    language: 'Токипона',
    description: '',
    categories: [],
    lessonOrder: ['l1'],
    referenceOrder: [],
    status: 'draft',
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
