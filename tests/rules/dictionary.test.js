import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
  await seed(env, 'courses/c1', course());
  await seed(env, 'courses/pending', course({ status: 'pending_review' }));
  await seed(env, 'courses/c1/dictionary/w1', {
    word: 'ihura', wordLower: 'ihura', translation: 'язык', partOfSpeech: 'noun',
    examples: [], notes: '', createdAt: new Date(), updatedAt: new Date(),
  });
});

const word = (extra = {}) => ({
  word: 'pona', wordLower: 'pona', translation: 'хороший', partOfSpeech: 'adjective',
  examples: ['toki pona'], notes: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
});

describe('dictionary (рабочая версия)', () => {
  it('автор добавляет, правит, удаляет слово', async () => {
    const db = as(env, 'alice');
    await assertSucceeds(setDoc(doc(db, 'courses/c1/dictionary/w2'), word()));
    await assertSucceeds(updateDoc(doc(db, 'courses/c1/dictionary/w1'), { translation: 'речь', updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(db, 'courses/c1/dictionary/w1')));
  });

  it('посторонний не читает и не пишет словарь черновика', async () => {
    await assertFails(getDoc(doc(as(env, 'bob'), 'courses/c1/dictionary/w1')));
    await assertFails(getDoc(doc(anon(env), 'courses/c1/dictionary/w1')));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/c1/dictionary/w2'), word()));
  });

  it('валидация: часть речи, длины, лишние поля, число примеров', async () => {
    const ref = doc(as(env, 'alice'), 'courses/c1/dictionary/w2');
    await assertFails(setDoc(ref, word({ partOfSpeech: 'magic' })));
    await assertFails(setDoc(ref, word({ word: '' })));
    await assertFails(setDoc(ref, word({ translation: 'x'.repeat(301) })));
    await assertFails(setDoc(ref, word({ examples: Array(11).fill('a') })));
    await assertFails(setDoc(ref, word({ html: '<b>' })));
  });

  it('createdAt нельзя подменить при правке', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/c1/dictionary/w1'), { createdAt: new Date(0), updatedAt: serverTimestamp() }));
  });

  it('в курсе на модерации словарь заморожен', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/pending/dictionary/w2'), word()));
  });
});
