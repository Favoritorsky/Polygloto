import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anon, as, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  for (const uid of ['alice', 'bob', 'carol']) await seed(env, `users/${uid}`, userProfile());
});

const follow = (db, followerId, authorId, id = `${followerId}_${authorId}`, extra = {}) =>
  setDoc(doc(db, `follows/${id}`), { followerId, authorId, createdAt: serverTimestamp(), ...extra });

describe('follows (v2)', () => {
  it('подписаться на автора можно; список подписчиков виден всем', async () => {
    await assertSucceeds(follow(as(env, 'bob'), 'bob', 'alice'));
    await assertSucceeds(getDocs(query(collection(anon(env), 'follows'), where('authorId', '==', 'alice'))));
  });

  it('на себя, за другого, с чужим id, на несуществующего автора и с лишними полями — нельзя', async () => {
    const db = as(env, 'bob');
    await assertFails(follow(db, 'bob', 'bob'));
    await assertFails(follow(db, 'carol', 'alice'));
    await assertFails(follow(db, 'bob', 'alice', 'whatever'));
    await assertFails(follow(db, 'bob', 'ghost'));
    await assertFails(follow(db, 'bob', 'alice', undefined, { extra: 1 }));
    await assertFails(follow(anon(env), 'bob', 'alice'));
  });

  it('подписка не меняется; отписаться может только сам подписчик', async () => {
    await follow(as(env, 'bob'), 'bob', 'alice');
    await assertFails(updateDoc(doc(as(env, 'bob'), 'follows/bob_alice'), { authorId: 'carol' }));
    await assertFails(deleteDoc(doc(as(env, 'alice'), 'follows/bob_alice')));
    await assertFails(deleteDoc(doc(as(env, 'carol'), 'follows/bob_alice')));
    await assertSucceeds(deleteDoc(doc(as(env, 'bob'), 'follows/bob_alice')));
  });
});
