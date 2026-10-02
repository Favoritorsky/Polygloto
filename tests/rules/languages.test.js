// Курируемый список языков (curatedLanguages) и поле languageCategory у курса.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
  await seed(env, 'curatedLanguages/es', { name: 'Испанский' });
  await seed(env, 'curatedLanguages/fr', { name: 'Французский' });
  await seed(env, 'courses/c1', course());
  await seed(env, 'courses/c1/lessons/l1', { title: 'Урок 1', blocks: [], updatedAt: new Date() });
  await seed(env, 'courses/es1', course({ language: 'Испанский', languageCategory: 'official', languageId: 'es' }));
});

describe('curatedLanguages', () => {
  it('читать может кто угодно, даже без входа', async () => {
    await assertSucceeds(getDoc(doc(anon(env), 'curatedLanguages/es')));
    await assertSucceeds(getDocs(collection(anon(env), 'curatedLanguages')));
  });

  it('добавлять, переименовывать и удалять может только админ', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'curatedLanguages/de'), { name: 'Немецкий' }));
    await assertFails(setDoc(doc(anon(env), 'curatedLanguages/de'), { name: 'Немецкий' }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'curatedLanguages/es'), { name: 'Испанский язык' }));
    await assertFails(deleteDoc(doc(as(env, 'alice'), 'curatedLanguages/es')));

    await assertSucceeds(setDoc(doc(as(env, 'admin'), 'curatedLanguages/de'), { name: 'Немецкий' }));
    await assertSucceeds(updateDoc(doc(as(env, 'admin'), 'curatedLanguages/de'), { name: 'Немецкий язык' }));
    await assertSucceeds(deleteDoc(doc(as(env, 'admin'), 'curatedLanguages/de')));
  });

  it('у языка только название длиной 2–60 символов', async () => {
    const db = as(env, 'admin');
    await assertFails(setDoc(doc(db, 'curatedLanguages/x'), { name: 'Я' }));
    await assertFails(setDoc(doc(db, 'curatedLanguages/x'), { name: 'x'.repeat(61) }));
    await assertFails(setDoc(doc(db, 'curatedLanguages/x'), { name: 'Немецкий', extra: 1 }));
    await assertSucceeds(setDoc(doc(db, 'curatedLanguages/x'), { name: 'x'.repeat(60) }));
  });
});

describe('courses: languageCategory', () => {
  function create(db, uid, overrides) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'courses/new'), {
      ...course({ authorId: uid, lessonOrder: ['l1'], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
      ...overrides,
    });
    batch.set(doc(db, 'courses/new/lessons/l1'), { title: 'Урок 1', blocks: [], updatedAt: serverTimestamp() });
    batch.set(doc(db, 'rateLimits/' + uid), { createCourse: serverTimestamp() }, { merge: true });
    return batch.commit();
  }

  it('курс с языком из списка создаётся как official', async () => {
    await assertSucceeds(create(as(env, 'alice'), 'alice', { language: 'Испанский', languageCategory: 'official', languageId: 'es' }));
  });

  it('свой язык создаётся как custom', async () => {
    await assertSucceeds(create(as(env, 'alice'), 'alice', { language: 'Эсперанто', languageCategory: 'custom', languageId: null }));
  });

  it('нельзя назвать official язык, которого нет в списке', async () => {
    await assertFails(create(as(env, 'alice'), 'alice', { language: 'Эсперанто', languageCategory: 'official', languageId: 'eo' }));
    await assertFails(create(as(env, 'alice'), 'alice', { language: 'Эсперанто', languageCategory: 'official', languageId: null }));
  });

  it('official требует ровно того названия, что в списке', async () => {
    await assertFails(create(as(env, 'alice'), 'alice', { language: 'Эсперанто', languageCategory: 'official', languageId: 'es' }));
    await assertFails(create(as(env, 'alice'), 'alice', { language: 'испанский', languageCategory: 'official', languageId: 'es' }));
  });

  it('custom не может ссылаться на язык из списка, а без категории курс не создать', async () => {
    await assertFails(create(as(env, 'alice'), 'alice', { language: 'Испанский', languageCategory: 'custom', languageId: 'es' }));
    await assertFails(create(as(env, 'alice'), 'alice', { languageCategory: null }));
    await assertFails(create(as(env, 'alice'), 'alice', { languageCategory: 'secret' }));
  });

  it('при правке нельзя подделать категорию', async () => {
    const ref = doc(as(env, 'alice'), 'courses/c1');
    await assertFails(updateDoc(ref, { languageCategory: 'official', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { languageCategory: 'official', languageId: 'es', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { language: 'Эсперанто', languageCategory: 'official', languageId: 'fr', updatedAt: serverTimestamp() }));
    // Сменить язык на официальный можно, только указав его название из списка.
    await assertSucceeds(
      updateDoc(ref, { language: 'Французский', languageCategory: 'official', languageId: 'fr', updatedAt: serverTimestamp() }),
    );
  });

  it('у официального курса нельзя сменить название языка, не сменив категорию', async () => {
    const ref = doc(as(env, 'alice'), 'courses/es1');
    await assertFails(updateDoc(ref, { language: 'Эсперанто', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { language: 'Эсперанто', languageCategory: 'custom', languageId: null, updatedAt: serverTimestamp() }));
  });

  it('если язык переименовали в списке, курс отправляется на проверку только с новым названием', async () => {
    await seed(env, 'curatedLanguages/es', { name: 'Испанский (Испания)' });
    const verified = as(env, 'alice', { verified: true });
    const ref = doc(verified, 'courses/es1');
    await assertFails(updateDoc(ref, { status: 'pending_review', submittedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(ref, { language: 'Испанский (Испания)', languageCategory: 'official', languageId: 'es', updatedAt: serverTimestamp() }),
    );
    await assertSucceeds(updateDoc(ref, { status: 'pending_review', submittedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});
