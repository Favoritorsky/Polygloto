import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anon, as, course, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, 'users/alice', userProfile());
  await seed(env, 'users/bob', userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'users/banned', userProfile({ banned: true }));
  await seed(env, 'courses/c1', course());
  await seed(env, 'courses/c1/lessons/l1', { title: 'Урок 1', blocks: [], updatedAt: new Date() });
  await seed(env, 'courses/pub', course({ status: 'published', hasPublishedVersion: true }));
  await seed(env, 'courses/pending', course({ status: 'pending_review' }));
  await seed(env, 'courses/banned1', course({ authorId: 'banned' }));
});

const edit = (extra = {}) => ({ title: 'Новое название', updatedAt: serverTimestamp(), ...extra });

describe('courses: чтение', () => {
  it('черновик видят только автор и админ', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'alice'), 'courses/c1')));
    await assertSucceeds(getDoc(doc(as(env, 'admin'), 'courses/c1')));
    await assertFails(getDoc(doc(as(env, 'bob'), 'courses/c1')));
    await assertFails(getDoc(doc(anon(env), 'courses/c1')));
  });

  it('список: только свои курсы или админ', async () => {
    await assertSucceeds(getDocs(query(collection(as(env, 'alice'), 'courses'), where('authorId', '==', 'alice'))));
    await assertFails(getDocs(collection(as(env, 'alice'), 'courses')));
    await assertFails(getDocs(query(collection(as(env, 'bob'), 'courses'), where('authorId', '==', 'alice'))));
    await assertSucceeds(getDocs(query(collection(as(env, 'admin'), 'courses'), where('status', '==', 'pending_review'))));
  });

  it('уроки черновика не видны посторонним', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'alice'), 'courses/c1/lessons/l1')));
    await assertFails(getDoc(doc(as(env, 'bob'), 'courses/c1/lessons/l1')));
    await assertFails(getDoc(doc(anon(env), 'courses/c1/lessons/l1')));
  });
});

describe('courses: создание и удаление', () => {
  it('клиент не может создать курс напрямую (только через createCourse)', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/new'), course()));
  });

  it('удаляет автор или админ, но не посторонний и не забаненный', async () => {
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/c1')));
    await assertFails(deleteDoc(doc(as(env, 'banned'), 'courses/banned1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/c1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'admin'), 'courses/pub')));
  });
});

describe('courses: правка контента', () => {
  it('автор правит черновик', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'alice'), 'courses/c1'), edit()));
  });

  it('админ может править любой черновик', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'admin'), 'courses/c1'), edit()));
  });

  it('посторонний и забаненный не могут править', async () => {
    await assertFails(updateDoc(doc(as(env, 'bob'), 'courses/c1'), edit()));
    await assertFails(updateDoc(doc(as(env, 'banned'), 'courses/banned1'), edit()));
  });

  it('нельзя подменить authorId, hasPublishedVersion, rejectionReason', async () => {
    const ref = doc(as(env, 'alice'), 'courses/c1');
    await assertFails(updateDoc(ref, edit({ authorId: 'bob' })));
    await assertFails(updateDoc(ref, edit({ hasPublishedVersion: true })));
    await assertFails(updateDoc(ref, edit({ rejectionReason: 'x' })));
    await assertFails(updateDoc(ref, edit({ likesCount: 999 })));
  });

  it('updatedAt обязан быть серверным временем', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/c1'), { title: 'Ок название', updatedAt: new Date(0) }));
  });

  it('проверяются длины полей', async () => {
    const ref = doc(as(env, 'alice'), 'courses/c1');
    await assertFails(updateDoc(ref, edit({ title: 'ab' })));
    await assertFails(updateDoc(ref, edit({ title: 'x'.repeat(121) })));
    await assertSucceeds(updateDoc(ref, edit({ title: 'x'.repeat(120) })));
    await assertFails(updateDoc(ref, edit({ description: 'x'.repeat(2001) })));
    await assertFails(updateDoc(ref, edit({ categories: Array.from({ length: 21 }, (_, i) => ({ id: `c${i}` })) })));
  });

  it('в pending_review и published контент заморожен', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/pending'), edit()));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/pub'), edit()));
  });
});

describe('courses: переходы статуса', () => {
  const to = (status, extra = {}) => ({ status, updatedAt: serverTimestamp(), ...extra });

  it('draft → pending_review только с подтверждённой почтой', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/c1'), to('pending_review', { submittedAt: serverTimestamp() })));
    await assertSucceeds(
      updateDoc(doc(as(env, 'alice', { verified: true }), 'courses/c1'), to('pending_review', { submittedAt: serverTimestamp() })),
    );
  });

  it('автор не может сам опубликовать или отклонить курс', async () => {
    const ref = doc(as(env, 'alice', { verified: true }), 'courses/c1');
    await assertFails(updateDoc(ref, to('published')));
    await assertFails(updateDoc(ref, to('rejected')));
    await assertFails(updateDoc(doc(as(env, 'alice', { verified: true }), 'courses/pending'), to('published')));
  });

  it('админ через клиент тоже не публикует (только функция moderateCourse)', async () => {
    await assertFails(updateDoc(doc(as(env, 'admin', { verified: true }), 'courses/pending'), to('published')));
  });

  it('отозвать с проверки и начать правку опубликованного можно', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'alice'), 'courses/pending'), to('draft')));
    await assertSucceeds(updateDoc(doc(as(env, 'alice'), 'courses/pub'), to('draft')));
  });

  it('смена статуса вместе с контентом запрещена', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/pub'), to('draft', { title: 'Тихо поменяли' })));
    await assertFails(
      updateDoc(doc(as(env, 'alice', { verified: true }), 'courses/c1'), to('pending_review', { submittedAt: serverTimestamp(), title: 'ааа' })),
    );
  });

  it('неизвестный статус запрещён', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/c1'), to('hacked')));
  });
});

describe('courses: уроки и справочник', () => {
  const section = (extra = {}) => ({ title: 'Урок', blocks: [], updatedAt: serverTimestamp(), ...extra });

  it('автор создаёт урок пакетно вместе с обновлением порядка', async () => {
    const db = as(env, 'alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'courses/c1/lessons/l2'), section());
    batch.update(doc(db, 'courses/c1'), { lessonOrder: arrayUnion('l2'), updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it('автор правит и удаляет урок черновика', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'alice'), 'courses/c1/lessons/l1'), { blocks: [{ type: 'paragraph' }], updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/c1/lessons/l1')));
  });

  it('раздел справочника — те же правила', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'alice'), 'courses/c1/reference/r1'), section()));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/c1/reference/r1'), section()));
  });

  it('посторонний не может писать уроки', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/c1/lessons/x'), section()));
  });

  it('нельзя писать уроки курса на модерации или опубликованного', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/pending/lessons/x'), section()));
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/pub/lessons/x'), section()));
  });

  it('лишние поля и слишком много блоков запрещены', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/c1/lessons/x'), section({ html: '<script>' })));
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/c1/lessons/x'), section({ blocks: Array(401).fill({ type: 'paragraph' }) })));
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/c1/lessons/x'), section({ blocks: 'строка' })));
  });

  it('нельзя писать урок в несуществующий курс', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/nope/lessons/x'), section()));
  });
});
