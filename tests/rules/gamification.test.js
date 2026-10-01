import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { applyStatsEvent, dayIndex, weekIndex } from '../../shared/gamification.js';
import { anon, as, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});

const BLOCKS = [
  { type: 'task', id: 't1', taskType: 'free_input', data: { question: 'q', answers: ['a'] } },
  { type: 'task', id: 't2', taskType: 'free_input', data: { question: 'q', answers: ['a'] } },
];
const DAY = 86400000;

beforeEach(async () => {
  await env.clearFirestore();
  for (const uid of ['bob', 'carol']) await seed(env, `users/${uid}`, userProfile());
  await seed(env, 'publicCourses/c1', { authorId: 'alice', title: 'Курс', lessonOrder: ['l1', 'l2'] });
  await seed(env, 'publicCourses/c1/lessons/l1', { title: 'Урок', blocks: BLOCKS });
  await seed(env, 'publicCourses/c1/lessons/l2', { title: 'Урок 2', blocks: [] });
  await seed(env, 'publicCourses/c1/dictionary/w1', { word: 'hola', wordLower: 'hola', translation: 'привет' });
});

const stats = (prev, type, detail, extra = {}) => ({
  ...applyStatsEvent(prev, type, detail, Date.now()),
  updatedAt: serverTimestamp(),
  ...extra,
});

/** Первая попытка задания + статистика, как в taskStatsService. */
function taskEvent(uid, { taskId = 't1', correct = true, prev = null, data } = {}) {
  const db = as(env, uid);
  const batch = writeBatch(db);
  const id = `c1_l1_${taskId}`;
  batch.set(doc(db, `users/${uid}/taskResults/${id}`), {
    courseId: 'c1',
    lessonId: 'l1',
    taskId,
    blockIndex: BLOCKS.findIndex((b) => b.id === taskId),
    correct,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, `userStats/${uid}`), data ?? stats(prev, 'task', { correct }, { lastEvent: 'task', lastEventId: id }));
  return batch.commit();
}

function lessonEvent(uid, { lessonId = 'l1', prev = null, data } = {}) {
  const db = as(env, uid);
  const batch = writeBatch(db);
  const id = `c1_${lessonId}`;
  batch.set(doc(db, `users/${uid}/lessonProgress/${id}`), { courseId: 'c1', lessonId, completedAt: serverTimestamp() });
  batch.set(doc(db, `userStats/${uid}`), data ?? stats(prev, 'lesson', {}, { lastEvent: 'lesson', lastEventId: id }));
  return batch.commit();
}

async function seedCard(uid, overrides = {}) {
  await seed(env, `users/${uid}/srsCards/c1_w1`, {
    courseId: 'c1',
    wordId: 'w1',
    word: 'hola',
    translation: 'привет',
    interval: 1,
    repetitions: 1,
    easeFactor: 2.5,
    dueAt: Timestamp.fromMillis(Date.now() - 60000),
    lastReviewedAt: Timestamp.fromMillis(Date.now() - DAY),
    createdAt: Timestamp.fromMillis(Date.now() - 2 * DAY),
    ...overrides,
  });
}

/** Повторение «Вспомнил» + статистика, как в srsService.submitReview. */
function reviewEvent(uid, { prev = null, scored = true, data, interval = 3, repetitions = 2 } = {}) {
  const db = as(env, uid);
  const batch = writeBatch(db);
  batch.update(doc(db, `users/${uid}/srsCards/c1_w1`), {
    interval,
    repetitions,
    easeFactor: 2.5,
    dueAt: Timestamp.fromMillis(Date.now() + interval * DAY),
    lastReviewedAt: serverTimestamp(),
  });
  batch.set(doc(db, `userStats/${uid}`), data ?? stats(prev, 'review', { scored }, { lastEvent: 'review', lastEventId: 'c1_w1' }));
  return batch.commit();
}

describe('userStats', () => {
  it('задание: +10 за верную первую попытку, читают все', async () => {
    await assertSucceeds(taskEvent('bob'));
    const snap = await getDoc(doc(anon(env), 'userStats/bob'));
    if (snap.data().points !== 10 || snap.data().streak !== 1) throw new Error(JSON.stringify(snap.data()));
  });

  it('+2 за неверную; нельзя приписать больше', async () => {
    await assertFails(
      taskEvent('bob', { correct: false, data: stats(null, 'task', { correct: true }, { lastEvent: 'task', lastEventId: 'c1_l1_t1' }) }),
    );
    await assertSucceeds(taskEvent('bob', { correct: false }));
  });

  it('без события, с чужим событием или повторно — нельзя', async () => {
    const db = as(env, 'bob');
    await assertFails(
      setDoc(doc(db, 'userStats/bob'), stats(null, 'task', { correct: true }, { lastEvent: 'task', lastEventId: 'c1_l1_t1' })),
    );
    await assertSucceeds(taskEvent('bob'));
    const prev = (await getDoc(doc(db, 'userStats/bob'))).data();
    // то же задание второй раз: отметка уже есть
    await assertFails(taskEvent('bob', { prev }));
    // ссылка на отметку, созданную раньше, без нового события
    await assertFails(
      setDoc(doc(db, 'userStats/bob'), stats(prev, 'task', { correct: true }, { lastEvent: 'task', lastEventId: 'c1_l1_t1' })),
    );
    // за другого пользователя
    await assertFails(setDoc(doc(as(env, 'carol'), 'userStats/bob'), stats(prev, 'lesson', {}, { lastEvent: 'lesson', lastEventId: 'x' })));
  });

  it('нельзя подделать серию, недельные и дневные счётчики, лишние поля', async () => {
    const event = { lastEvent: 'task', lastEventId: 'c1_l1_t1' };
    for (const patch of [
      { streak: 5 },
      { bestStreak: 9 },
      { weekPoints: 100 },
      { dayTasks: 3 },
      { tasksCount: 2 },
      { badge: 'x' },
      { dayIndex: 1 },
    ]) {
      await assertFails(taskEvent('bob', { data: { ...stats(null, 'task', { correct: true }, event), ...patch } }));
    }
  });

  it('серия продолжается со вчерашнего дня', async () => {
    const today = dayIndex(Date.now());
    await seed(env, 'userStats/bob', {
      ...applyStatsEvent(null, 'task', { correct: true }, Date.now() - DAY),
      lastEvent: 'task',
      lastEventId: 'old',
      updatedAt: new Date(),
    });
    const prev = (await getDoc(doc(as(env, 'bob'), 'userStats/bob'))).data();
    await assertSucceeds(taskEvent('bob', { prev }));
    const now = (await getDoc(doc(as(env, 'bob'), 'userStats/bob'))).data();
    if (now.streak !== 2 || now.lastActiveDay !== today || now.dayTasks !== 1) throw new Error(JSON.stringify(now));
  });

  it('урок: +20 один раз, серию не продлевает; отметку урока нельзя удалить', async () => {
    await assertSucceeds(lessonEvent('bob'));
    const s = (await getDoc(doc(as(env, 'bob'), 'userStats/bob'))).data();
    if (s.points !== 20 || s.streak !== 0) throw new Error(JSON.stringify(s));
    await assertFails(lessonEvent('bob', { prev: s }));
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'users/bob/lessonProgress/c1_l1')));
  });

  it('повторение: +2, только вместе с повторением карточки', async () => {
    await seedCard('bob');
    await assertSucceeds(reviewEvent('bob'));
    const s = (await getDoc(doc(as(env, 'bob'), 'userStats/bob'))).data();
    if (s.points !== 2 || s.reviewsCount !== 1 || s.streak !== 1) throw new Error(JSON.stringify(s));
    // Без новой записи карточки — нельзя.
    await assertFails(
      setDoc(doc(as(env, 'bob'), 'userStats/bob'), stats(s, 'review', { scored: true }, { lastEvent: 'review', lastEventId: 'c1_w1' })),
    );
  });

  it('первое повторение новой карточки: серия да, очков нет', async () => {
    await seedCard('bob', { interval: 0, repetitions: 0, lastReviewedAt: null });
    const first = { interval: 1, repetitions: 1 };
    await assertFails(reviewEvent('bob', { ...first, data: stats(null, 'review', { scored: true }, { lastEvent: 'review', lastEventId: 'c1_w1' }) }));
    await assertSucceeds(reviewEvent('bob', { ...first, scored: false }));
  });
});

describe('рейтинг недели', () => {
  const week = () => weekIndex(dayIndex(Date.now()));

  it('запись равна недельным очкам после той же записи', async () => {
    const db = as(env, 'bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users/bob/taskResults/c1_l1_t1'), {
      courseId: 'c1',
      lessonId: 'l1',
      taskId: 't1',
      blockIndex: 0,
      correct: true,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'userStats/bob'), stats(null, 'task', { correct: true }, { lastEvent: 'task', lastEventId: 'c1_l1_t1' }));
    batch.set(doc(db, `leaderboards/${week()}/entries/bob`), { points: 10 });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDocs(collection(anon(env), `leaderboards/${week()}/entries`)));
  });

  it('нельзя записать больше очков, в чужую неделю или за другого', async () => {
    await assertSucceeds(taskEvent('bob'));
    const db = as(env, 'bob');
    await assertFails(setDoc(doc(db, `leaderboards/${week()}/entries/bob`), { points: 999 }));
    await assertFails(setDoc(doc(db, `leaderboards/${week() + 1}/entries/bob`), { points: 10 }));
    await assertFails(setDoc(doc(as(env, 'carol'), `leaderboards/${week()}/entries/bob`), { points: 10 }));
    await assertSucceeds(setDoc(doc(db, `leaderboards/${week()}/entries/bob`), { points: 10 }));
  });
});

describe('completedCourses', () => {
  it('нужны первый и последний уроки; видно всем; нельзя удалить', async () => {
    const db = as(env, 'bob');
    await assertFails(setDoc(doc(db, 'users/bob/completedCourses/c1'), { completedAt: serverTimestamp() }));
    await assertSucceeds(lessonEvent('bob'));
    await assertFails(setDoc(doc(db, 'users/bob/completedCourses/c1'), { completedAt: serverTimestamp() }));
    const s = (await getDoc(doc(db, 'userStats/bob'))).data();
    await assertSucceeds(lessonEvent('bob', { lessonId: 'l2', prev: s }));
    await assertSucceeds(setDoc(doc(db, 'users/bob/completedCourses/c1'), { completedAt: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(anon(env), 'users/bob/completedCourses/c1')));
    await assertFails(setDoc(doc(as(env, 'carol'), 'users/carol/completedCourses/c1'), { completedAt: serverTimestamp() }));
  });
});
