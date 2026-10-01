import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, course, createEnv, seed, userProfile } from './helpers.js';

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
  await seed(env, 'courses/c1', course({ coAuthors: ['bob'] }));
  await seed(env, 'courses/c1/lessons/l1', { title: 'Урок 1', blocks: [], updatedAt: new Date() });
  await seed(env, 'courses/pub', course({ coAuthors: ['bob'], status: 'published', hasPublishedVersion: true }));
  await seed(env, 'publicCourses/pub', { authorId: 'alice', title: 'Курс', coAuthors: ['bob'] });
  await seed(env, 'publicCourses/pub/taskStats/l1_t1', { lessonId: 'l1', taskId: 't1', attempts: 5, wrong: 1 });
});

const setCoAuthors = (uid, list, id = 'c1') =>
  updateDoc(doc(as(env, uid), `courses/${id}`), { coAuthors: list, updatedAt: serverTimestamp() });

describe('соавторы (v2)', () => {
  it('соавтор читает и правит черновик, как автор', async () => {
    const db = as(env, 'bob');
    await assertSucceeds(getDoc(doc(db, 'courses/c1')));
    await assertSucceeds(getDoc(doc(db, 'courses/c1/lessons/l1')));
    await assertSucceeds(updateDoc(doc(db, 'courses/c1'), { title: 'Новое название', updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'courses/c1/lessons/l1'), { title: 'Правка', blocks: [], updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(as(env, 'carol'), 'courses/c1')));
    await assertFails(setDoc(doc(as(env, 'carol'), 'courses/c1/lessons/l1'), { title: 'x', blocks: [], updatedAt: serverTimestamp() }));
  });

  it('соавтор может вернуть опубликованный курс в черновик', async () => {
    await assertSucceeds(updateDoc(doc(as(env, 'bob'), 'courses/pub'), { status: 'draft', updatedAt: serverTimestamp() }));
  });

  it('«Мои курсы»: соавтор находит курс запросом array-contains', async () => {
    await assertSucceeds(getDocs(query(collection(as(env, 'bob'), 'courses'), where('coAuthors', 'array-contains', 'bob'))));
    await assertFails(getDocs(query(collection(as(env, 'carol'), 'courses'), where('coAuthors', 'array-contains', 'bob'))));
  });

  it('удалить курс и менять соавторов может только автор', async () => {
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/c1')));
    await assertFails(setCoAuthors('bob', ['bob', 'carol']));
    await assertFails(setCoAuthors('bob', []));
    await assertFails(updateDoc(doc(as(env, 'bob'), 'courses/c1'), { authorId: 'bob', updatedAt: serverTimestamp() }));
    await assertSucceeds(setCoAuthors('alice', ['bob', 'carol']));
    await assertSucceeds(setCoAuthors('alice', [], 'pub'));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/c1')));
  });

  it('список соавторов: до 5, без повторов, без автора, только строки', async () => {
    await assertFails(setCoAuthors('alice', ['a', 'b', 'c', 'd', 'e', 'f']));
    await assertFails(setCoAuthors('alice', ['carol', 'carol']));
    await assertFails(setCoAuthors('alice', ['alice']));
    await assertFails(setCoAuthors('alice', [42]));
    await assertFails(setCoAuthors('alice', 'carol'));
    await assertSucceeds(setCoAuthors('alice', ['a', 'b', 'c', 'd', 'e']));
  });

  it('соавтор не удаляет контент опубликованного курса', async () => {
    await seed(env, 'courses/pub/lessons/l1', { title: 'Урок', blocks: [], updatedAt: new Date() });
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/pub/lessons/l1')));
  });

  it('статистику заданий видят соавторы, удалить её не могут', async () => {
    await assertSucceeds(getDocs(collection(as(env, 'bob'), 'publicCourses/pub/taskStats')));
    await assertFails(getDocs(collection(as(env, 'carol'), 'publicCourses/pub/taskStats')));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'publicCourses/pub/taskStats/l1_t1')));
  });
});
