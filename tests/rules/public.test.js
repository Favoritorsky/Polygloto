import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
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
  await seed(env, 'users/alice', userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'publicCourses/c1', { authorId: 'alice', title: 'Курс', likesCount: 0, dislikesCount: 0 });
  await seed(env, 'publicCourses/c1/lessons/l1', { title: 'Урок', blocks: [] });
  await seed(env, 'publicCourses/c1/secret/x', { a: 1 });
});

describe('publicCourses', () => {
  it('читают все, включая анонимов', async () => {
    await assertSucceeds(getDoc(doc(anon(env), 'publicCourses/c1')));
    await assertSucceeds(getDocs(collection(anon(env), 'publicCourses')));
    await assertSucceeds(getDoc(doc(anon(env), 'publicCourses/c1/lessons/l1')));
  });

  it('неизвестные подколлекции не читаются', async () => {
    await assertFails(getDoc(doc(anon(env), 'publicCourses/c1/secret/x')));
  });

  it('никто из клиентов не пишет снимок: ни автор, ни админ', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'publicCourses/c2'), { authorId: 'alice', title: 'Сам опубликовал' }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'publicCourses/c1'), { title: 'Подмена' }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'publicCourses/c1'), { likesCount: 1000 }));
    await assertFails(setDoc(doc(as(env, 'admin'), 'publicCourses/c1/lessons/l1'), { title: 'x', blocks: [] }));
    await assertFails(deleteDoc(doc(as(env, 'admin'), 'publicCourses/c1')));
  });
});

describe('catalogMeta', () => {
  it('список языков читают все, но никто из клиентов не пишет', async () => {
    await seed(env, 'catalogMeta/languages', { items: [] });
    await assertSucceeds(getDoc(doc(anon(env), 'catalogMeta/languages')));
    await assertFails(setDoc(doc(as(env, 'alice'), 'catalogMeta/languages'), { items: [{ key: 'x', name: 'x', count: 999 }] }));
    await assertFails(setDoc(doc(as(env, 'admin'), 'catalogMeta/languages'), { items: [] }));
    await assertFails(deleteDoc(doc(as(env, 'admin'), 'catalogMeta/languages')));
  });
});
