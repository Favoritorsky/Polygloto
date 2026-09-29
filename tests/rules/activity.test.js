import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
  for (const uid of ['alice', 'bob', 'carol']) await seed(env, `users/${uid}`, userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'users/banned', userProfile({ banned: true }));
  // pub — опубликован (автор alice), draft — нет
  await seed(env, 'courses/pub', course({ status: 'published', hasPublishedVersion: true }));
  await seed(env, 'publicCourses/pub', { authorId: 'alice', title: 'Курс', likesCount: 0, dislikesCount: 0 });
  await seed(env, 'publicCourses/pub/lessons/l1', { title: 'Урок', blocks: [] });
  await seed(env, 'courses/pub/comments/c1', { authorId: 'bob', authorName: 'Боб', text: 'Круто', createdAt: new Date() });
  await seed(env, 'courses/draft', course());
});

const rating = (value = 'like') => ({ value, updatedAt: serverTimestamp() });
const reaction = (uid, targetType, targetId, emoji = '👍') => ({ uid, targetType, targetId, emoji, createdAt: serverTimestamp() });

describe('ratings', () => {
  it('пользователь ставит, меняет и снимает свою оценку', async () => {
    const ref = doc(as(env, 'bob'), 'courses/pub/ratings/bob');
    await assertSucceeds(setDoc(ref, rating('like')));
    await assertSucceeds(setDoc(ref, rating('dislike')));
    await assertSucceeds(deleteDoc(ref));
  });

  it('читатель без подтверждённой почты тоже может оценивать', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'carol', { verified: false }), 'courses/pub/ratings/carol'), rating()));
  });

  it('нельзя голосовать за другого и накручивать значения', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/ratings/carol'), rating()));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/ratings/bob'), { value: 'like', weight: 100, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/ratings/bob'), rating('superlike')));
  });

  it('автор не оценивает свой курс; аноним и забаненный не оценивают', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'courses/pub/ratings/alice'), rating()));
    await assertFails(setDoc(doc(anon(env), 'courses/pub/ratings/x'), rating()));
    await assertFails(setDoc(doc(as(env, 'banned'), 'courses/pub/ratings/banned'), rating()));
  });

  it('неопубликованный курс оценить нельзя', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/draft/ratings/bob'), rating()));
  });

  it('чужие оценки не читаются', async () => {
    await seed(env, 'courses/pub/ratings/carol', { value: 'dislike', updatedAt: new Date() });
    await assertFails(getDoc(doc(as(env, 'bob'), 'courses/pub/ratings/carol')));
    await assertFails(getDocs(collection(as(env, 'bob'), 'courses/pub/ratings')));
    await assertSucceeds(getDoc(doc(as(env, 'carol'), 'courses/pub/ratings/carol')));
  });
});

describe('comments', () => {
  it('читают все у опубликованного курса, но не у черновика', async () => {
    await assertSucceeds(getDocs(collection(anon(env), 'courses/pub/comments')));
    await assertFails(getDocs(collection(anon(env), 'courses/draft/comments')));
  });

  it('создать напрямую нельзя (только через addComment)', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/comments/c2'), { authorId: 'bob', authorName: 'Боб', text: 'x', createdAt: serverTimestamp() }));
  });

  it('редактировать нельзя никому', async () => {
    await assertFails(updateDoc(doc(as(env, 'bob'), 'courses/pub/comments/c1'), { text: 'изменил' }));
  });

  it('удаляет автор комментария, автор курса или админ, но не посторонний', async () => {
    await assertFails(deleteDoc(doc(as(env, 'carol'), 'courses/pub/comments/c1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'bob'), 'courses/pub/comments/c1')));
    await seed(env, 'courses/pub/comments/c1', { authorId: 'bob', authorName: 'Боб', text: 'Круто', createdAt: new Date() });
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/pub/comments/c1')));
    await seed(env, 'courses/pub/comments/c1', { authorId: 'bob', authorName: 'Боб', text: 'Круто', createdAt: new Date() });
    await assertSucceeds(deleteDoc(doc(as(env, 'admin'), 'courses/pub/comments/c1')));
  });
});

describe('reactions', () => {
  it('реакция на урок и на комментарий', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/bob_lesson_l1'), reaction('bob', 'lesson', 'l1')));
    await assertSucceeds(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/bob_comment_c1'), reaction('bob', 'comment', 'c1', '❤️')));
  });

  it('id документа должен соответствовать пользователю и цели (один голос на цель)', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/random'), reaction('bob', 'lesson', 'l1')));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/carol_lesson_l1'), reaction('carol', 'lesson', 'l1')));
  });

  it('только эмодзи из набора и существующие цели', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/bob_lesson_l1'), reaction('bob', 'lesson', 'l1', '💩')));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/bob_lesson_nope'), reaction('bob', 'lesson', 'nope')));
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/reactions/bob_course_pub'), reaction('bob', 'course', 'pub')));
  });

  it('снять можно только свою', async () => {
    await seed(env, 'courses/pub/reactions/carol_lesson_l1', { uid: 'carol', targetType: 'lesson', targetId: 'l1', emoji: '👍', createdAt: new Date() });
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/pub/reactions/carol_lesson_l1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'carol'), 'courses/pub/reactions/carol_lesson_l1')));
  });

  it('забаненный и аноним не ставят реакции', async () => {
    await assertFails(setDoc(doc(as(env, 'banned'), 'courses/pub/reactions/banned_lesson_l1'), reaction('banned', 'lesson', 'l1')));
    await assertFails(setDoc(doc(anon(env), 'courses/pub/reactions/x_lesson_l1'), reaction('x', 'lesson', 'l1')));
  });
});
