import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});

const BLOCKS = [
  { type: 'paragraph', children: [{ text: 'Текст' }] },
  { type: 'task', id: 't1', taskType: 'free_input', data: { question: 'q', answers: ['a'] } },
];

beforeEach(async () => {
  await env.clearFirestore();
  for (const uid of ['alice', 'bob', 'carol']) await seed(env, `users/${uid}`, userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'publicCourses/c1', { authorId: 'alice', title: 'Курс' });
  await seed(env, 'publicCourses/c1/lessons/l1', { title: 'Урок', blocks: BLOCKS });
});

/** Первая попытка, как в taskStatsService: отметка + увеличение суммы одной записью. */
function attempt(uid, { correct = true, blockIndex = 1, taskId = 't1', stat = {}, marker = {} } = {}) {
  const db = as(env, uid);
  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}/taskResults/c1_l1_${taskId}`), {
    courseId: 'c1',
    lessonId: 'l1',
    taskId,
    blockIndex,
    correct,
    createdAt: serverTimestamp(),
    ...marker,
  });
  batch.set(
    doc(db, `publicCourses/c1/taskStats/l1_${taskId}`),
    { lessonId: 'l1', taskId, attempts: increment(1), wrong: increment(correct ? 0 : 1), ...stat },
    { merge: true },
  );
  return batch.commit();
}

describe('taskResults + taskStats', () => {
  it('первая попытка увеличивает сумму; вторая — нет', async () => {
    await assertSucceeds(attempt('bob', { correct: false }));
    await assertSucceeds(attempt('carol', { correct: true }));
    await assertFails(attempt('bob', { correct: true }));
    const snap = await getDoc(doc(as(env, 'alice'), 'publicCourses/c1/taskStats/l1_t1'));
    if (snap.data().attempts !== 2 || snap.data().wrong !== 1) throw new Error(JSON.stringify(snap.data()));
  });

  it('нельзя накрутить: +2, неверный счёт ошибок, без отметки', async () => {
    await assertFails(attempt('bob', { stat: { attempts: increment(2) } }));
    await assertFails(attempt('bob', { correct: true, stat: { wrong: increment(1) } }));
    await assertFails(attempt('bob', { correct: false, stat: { wrong: increment(0) } }));
    const db = as(env, 'bob');
    await assertFails(setDoc(doc(db, 'publicCourses/c1/taskStats/l1_t1'), { lessonId: 'l1', taskId: 't1', attempts: 1, wrong: 0 }));
  });

  it('отметка только на настоящее задание опубликованного урока', async () => {
    await assertFails(attempt('bob', { blockIndex: 0 }));
    await assertFails(attempt('bob', { blockIndex: 5 }));
    await assertFails(attempt('bob', { taskId: 'nope' }));
    await assertFails(attempt('bob', { marker: { courseId: 'c2' } }));
    await assertFails(attempt('bob', { marker: { extra: 1 } }));
  });

  it('отметку нельзя удалить или изменить (иначе можно было бы засчитать попытку снова)', async () => {
    await assertSucceeds(attempt('bob'));
    const db = as(env, 'bob');
    await assertFails(deleteDoc(doc(db, 'users/bob/taskResults/c1_l1_t1')));
    await assertFails(setDoc(doc(db, 'users/bob/taskResults/c1_l1_t1'), { correct: false }, { merge: true }));
    await assertSucceeds(getDoc(doc(db, 'users/bob/taskResults/c1_l1_t1')));
    await assertFails(getDoc(doc(as(env, 'carol'), 'users/bob/taskResults/c1_l1_t1')));
  });

  it('за другого пользователя записать нельзя', async () => {
    const db = as(env, 'carol');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/bob/taskResults/c1_l1_t1'), {
      courseId: 'c1',
      lessonId: 'l1',
      taskId: 't1',
      blockIndex: 1,
      correct: true,
      createdAt: serverTimestamp(),
    });
    await assertFails(batch.commit());
  });

  it('суммы читают автор и админ, читатели — нет', async () => {
    await assertSucceeds(attempt('bob'));
    await assertSucceeds(getDocs(collection(as(env, 'alice'), 'publicCourses/c1/taskStats')));
    await assertSucceeds(getDocs(collection(as(env, 'admin'), 'publicCourses/c1/taskStats')));
    await assertFails(getDocs(collection(as(env, 'bob'), 'publicCourses/c1/taskStats')));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'publicCourses/c1/taskStats/l1_t1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'publicCourses/c1/taskStats/l1_t1')));
  });
});
