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
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, anon, createEnv, seed, userProfile } from './helpers.js';

const DAY = 86400000;
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
  await seed(env, 'publicCourses/c1', { authorId: 'bob', title: 'Курс' });
  await seed(env, 'publicCourses/c1/dictionary/w1', { word: 'hola', translation: 'привет' });
  await seed(env, 'publicCourses/c1/lessons/l1', { title: 'Урок', blocks: [] });
});

const newCard = (overrides = {}) => ({
  courseId: 'c1',
  wordId: 'w1',
  word: 'hola',
  translation: 'привет',
  interval: 0,
  easeFactor: 2.5,
  repetitions: 0,
  dueAt: serverTimestamp(),
  lastReviewedAt: null,
  createdAt: serverTimestamp(),
  ...overrides,
});

const seedCard = (overrides = {}) =>
  seed(env, 'users/alice/srsCards/c1_w1', {
    ...newCard(),
    dueAt: Timestamp.fromMillis(Date.now() - 1000),
    createdAt: Timestamp.fromMillis(Date.now() - DAY),
    ...overrides,
  });

const review = (overrides) => ({ lastReviewedAt: serverTimestamp(), ...overrides });

describe('srsCards: личные карточки', () => {
  it('создаёт только владелец, из опубликованного словаря и с совпадающим словом', async () => {
    const ref = (db) => doc(db, 'users/alice/srsCards/c1_w1');
    await assertFails(setDoc(ref(as(env, 'bob')), newCard()));
    await assertFails(setDoc(ref(anon(env)), newCard()));
    await assertFails(setDoc(ref(as(env, 'alice')), newCard({ translation: 'пока' })));
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice/srsCards/c1_w2'), newCard({ wordId: 'w2' })));
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice/srsCards/x'), newCard()));
    await assertFails(setDoc(ref(as(env, 'alice')), newCard({ interval: 30, repetitions: 5 })));
    await assertFails(setDoc(ref(as(env, 'alice')), newCard({ extra: 1 })));
    await assertSucceeds(setDoc(ref(as(env, 'alice')), newCard()));
  });

  it('читает и удаляет только владелец; запрос «к повторению» по сроку работает', async () => {
    await seedCard();
    await assertFails(getDoc(doc(as(env, 'bob'), 'users/alice/srsCards/c1_w1')));
    const due = query(collection(as(env, 'alice'), 'users/alice/srsCards'), where('dueAt', '<=', Timestamp.now()));
    await assertSucceeds(getDocs(due));
    await assertFails(getDocs(collection(as(env, 'bob'), 'users/alice/srsCards')));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'users/alice/srsCards/c1_w1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'users/alice/srsCards/c1_w1')));
  });

  it('«Вспомнил»: повторений +1, срок через interval дней (с допуском часов клиента)', async () => {
    await seedCard();
    const ref = doc(as(env, 'alice'), 'users/alice/srsCards/c1_w1');
    const dueIn = (days) => Timestamp.fromMillis(Date.now() + days * DAY);
    await assertFails(updateDoc(ref, review({ interval: 1, repetitions: 1, easeFactor: 2.5, dueAt: dueIn(30) })));
    await assertFails(updateDoc(ref, review({ interval: 1, repetitions: 3, easeFactor: 2.5, dueAt: dueIn(1) })));
    await assertFails(updateDoc(ref, review({ interval: 1, repetitions: 1, easeFactor: 9, dueAt: dueIn(1) })));
    await assertFails(updateDoc(ref, { interval: 1, repetitions: 1, easeFactor: 2.5, dueAt: dueIn(1), lastReviewedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, review({ interval: 1, repetitions: 1, easeFactor: 2.5, dueAt: dueIn(1), word: 'adiós' })));
    await assertSucceeds(updateDoc(ref, review({ interval: 1, repetitions: 1, easeFactor: 2.5, dueAt: dueIn(1) })));
  });

  it('повторить можно только карточку, срок которой наступил', async () => {
    await seedCard({ dueAt: Timestamp.fromMillis(Date.now() + DAY) });
    const ref = doc(as(env, 'alice'), 'users/alice/srsCards/c1_w1');
    await assertFails(updateDoc(ref, review({ interval: 1, repetitions: 1, easeFactor: 2.5, dueAt: Timestamp.fromMillis(Date.now() + DAY) })));
  });

  it('«Забыл»: с нуля и вернуть в течение часа', async () => {
    await seedCard({ interval: 10, repetitions: 4 });
    const ref = doc(as(env, 'alice'), 'users/alice/srsCards/c1_w1');
    await assertFails(updateDoc(ref, review({ interval: 0, repetitions: 0, easeFactor: 2.3, dueAt: Timestamp.fromMillis(Date.now() + DAY) })));
    await assertFails(updateDoc(ref, review({ interval: 0, repetitions: 3, easeFactor: 2.3, dueAt: Timestamp.fromMillis(Date.now() + 600000) })));
    await assertSucceeds(updateDoc(ref, review({ interval: 0, repetitions: 0, easeFactor: 2.3, dueAt: Timestamp.fromMillis(Date.now() + 600000) })));
  });
});

describe('lessonProgress: пройденные уроки', () => {
  const progress = (overrides = {}) => ({ courseId: 'c1', lessonId: 'l1', completedAt: serverTimestamp(), ...overrides });

  it('отмечает только владелец, только существующий опубликованный урок, один раз', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'users/alice/lessonProgress/c1_l1'), progress()));
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice/lessonProgress/c1_l2'), progress({ lessonId: 'l2' })));
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice/lessonProgress/zzz'), progress()));
    await assertSucceeds(setDoc(doc(as(env, 'alice'), 'users/alice/lessonProgress/c1_l1'), progress()));
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice/lessonProgress/c1_l1'), progress()));
    await assertFails(getDoc(doc(as(env, 'bob'), 'users/alice/lessonProgress/c1_l1')));
  });
});
