import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  for (const uid of ['alice', 'bob', 'carol']) await seed(env, `users/${uid}`, userProfile({ displayName: uid === 'bob' ? 'Боб' : 'Тестовый автор' }));
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'users/banned', userProfile({ banned: true }));
  // pub — опубликован (автор alice), draft — нет
  await seed(env, 'courses/pub', course({ status: 'published', hasPublishedVersion: true }));
  await seed(env, 'publicCourses/pub', { authorId: 'alice', title: 'Курс', likesCount: 0, dislikesCount: 0, score: 0 });
  await seed(env, 'publicCourses/pub/lessons/l1', { title: 'Урок', blocks: [] });
  await seed(env, 'courses/pub/comments/c1', { authorId: 'bob', authorName: 'Боб', text: 'Круто', createdAt: new Date() });
  await seed(env, 'courses/draft', course());
});

const rating = (value = 'like') => ({ value, updatedAt: serverTimestamp() });
const reaction = (uid, targetType, targetId, emoji = '👍') => ({ uid, targetType, targetId, emoji, createdAt: serverTimestamp() });

/** Голос так, как его пишет ratingService: голос и счётчики одной записью. */
function vote(db, courseId, uid, before, after, { likes, dislikes } = {}) {
  const dl = likes ?? (after === 'like' ? 1 : 0) - (before === 'like' ? 1 : 0);
  const dd = dislikes ?? (after === 'dislike' ? 1 : 0) - (before === 'dislike' ? 1 : 0);
  const batch = writeBatch(db);
  const ref = doc(db, `courses/${courseId}/ratings/${uid}`);
  if (after) batch.set(ref, rating(after));
  else batch.delete(ref);
  batch.update(doc(db, `publicCourses/${courseId}`), { likesCount: increment(dl), dislikesCount: increment(dd), score: increment(dl - dd) });
  return batch.commit();
}

const counters = async () => {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    data = (await getDoc(doc(ctx.firestore(), 'publicCourses/pub'))).data();
  });
  return [data.likesCount, data.dislikesCount, data.score];
};

describe('ratings', () => {
  it('пользователь ставит, меняет и снимает оценку — счётчики меняются ровно на разницу', async () => {
    const db = as(env, 'bob');
    await assertSucceeds(vote(db, 'pub', 'bob', null, 'like'));
    expect(await counters()).toEqual([1, 0, 1]);
    await assertSucceeds(vote(db, 'pub', 'bob', 'like', 'dislike'));
    expect(await counters()).toEqual([0, 1, -1]);
    await assertSucceeds(vote(as(env, 'carol'), 'pub', 'carol', null, 'dislike'));
    expect(await counters()).toEqual([0, 2, -2]);
    await assertSucceeds(vote(db, 'pub', 'bob', 'dislike', null));
    expect(await counters()).toEqual([0, 1, -1]);
  });

  it('читатель без подтверждённой почты тоже может оценивать', async () => {
    await assertSucceeds(vote(as(env, 'carol', { verified: false }), 'pub', 'carol', null, 'like'));
  });

  it('накрутка невозможна: счётчики без голоса, голос без счётчиков, лишние единицы', async () => {
    const db = as(env, 'bob');
    // Только счётчики.
    await assertFails(updateDoc(doc(db, 'publicCourses/pub'), { likesCount: increment(100), score: increment(100) }));
    // Только голос.
    await assertFails(setDoc(doc(db, 'courses/pub/ratings/bob'), rating('like')));
    // Голос + завышенные счётчики.
    await assertFails(vote(db, 'pub', 'bob', null, 'like', { likes: 5 }));
    await assertFails(vote(db, 'pub', 'bob', null, 'like', { likes: 1, dislikes: -1 }));
    // Повторный «лайк» при уже стоящем лайке не прибавляет.
    await assertSucceeds(vote(db, 'pub', 'bob', null, 'like'));
    await assertFails(vote(db, 'pub', 'bob', null, 'like'));
    // Нарушенный score.
    const batch = writeBatch(db);
    batch.set(doc(db, 'courses/pub/ratings/bob'), rating('dislike'));
    batch.update(doc(db, 'publicCourses/pub'), { likesCount: increment(-1), dislikesCount: increment(1), score: increment(5) });
    await assertFails(batch.commit());
    // Попутно поменять другие поля снимка нельзя.
    const batch2 = writeBatch(db);
    batch2.set(doc(db, 'courses/pub/ratings/bob'), rating('dislike'));
    batch2.update(doc(db, 'publicCourses/pub'), { likesCount: increment(-1), dislikesCount: increment(1), score: increment(-2), title: 'Взлом' });
    await assertFails(batch2.commit());
    expect(await counters()).toEqual([1, 0, 1]);
  });

  it('нельзя голосовать за другого и ставить странные значения', async () => {
    await assertFails(vote(as(env, 'bob'), 'pub', 'carol', null, 'like'));
    await assertFails(vote(as(env, 'bob'), 'pub', 'bob', null, 'superlike', { likes: 0, dislikes: 0 }));
    const db = as(env, 'bob');
    const batch = writeBatch(db);
    batch.set(doc(db, 'courses/pub/ratings/bob'), { value: 'like', weight: 100, updatedAt: serverTimestamp() });
    batch.update(doc(db, 'publicCourses/pub'), { likesCount: increment(1), score: increment(1) });
    await assertFails(batch.commit());
  });

  it('автор не оценивает свой курс; аноним и забаненный не оценивают', async () => {
    await assertFails(vote(as(env, 'alice'), 'pub', 'alice', null, 'like'));
    await assertFails(vote(anon(env), 'pub', 'x', null, 'like'));
    await assertFails(vote(as(env, 'banned'), 'pub', 'banned', null, 'like'));
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

/** Комментарий так, как его пишет commentService: комментарий и отметка лимита одной записью. */
function comment(db, uid, { text = 'Отличный курс', authorName = 'Боб', courseId = 'pub', id = 'new1' } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, `courses/${courseId}/comments/${id}`), { authorId: uid, authorName, text, createdAt: serverTimestamp() });
  batch.set(doc(db, `rateLimits/${uid}`), { addComment: serverTimestamp() }, { merge: true });
  return batch.commit();
}

describe('comments', () => {
  it('читают все', async () => {
    await assertSucceeds(getDocs(collection(anon(env), 'courses/pub/comments')));
  });

  it('создаёт вошедший пользователь со своим именем из профиля', async () => {
    await assertSucceeds(comment(as(env, 'bob'), 'bob'));
  });

  it('не чаще раза в 15 секунд', async () => {
    await assertSucceeds(comment(as(env, 'bob'), 'bob', { id: 'a' }));
    await assertFails(comment(as(env, 'bob'), 'bob', { id: 'b' }));
    await seed(env, 'rateLimits/bob', { addComment: Timestamp.fromMillis(Date.now() - 16000) });
    await assertSucceeds(comment(as(env, 'bob'), 'bob', { id: 'c' }));
  });

  it('без отметки лимита, с чужим именем или чужим authorId — нельзя', async () => {
    await assertFails(setDoc(doc(as(env, 'bob'), 'courses/pub/comments/x'), { authorId: 'bob', authorName: 'Боб', text: 'x', createdAt: serverTimestamp() }));
    await assertFails(comment(as(env, 'bob'), 'bob', { authorName: 'Администратор' }));
    await assertFails(comment(as(env, 'bob'), 'carol'));
  });

  it('длина текста и пробелы по краям', async () => {
    await assertFails(comment(as(env, 'bob'), 'bob', { text: '' }));
    await assertFails(comment(as(env, 'bob'), 'bob', { text: '  привет ' }));
    await assertFails(comment(as(env, 'bob'), 'bob', { text: 'x'.repeat(2001) }));
    await assertSucceeds(comment(as(env, 'bob'), 'bob', { text: 'x'.repeat(2000) }));
  });

  it('у неопубликованного курса, от забаненного и анонима — нельзя', async () => {
    await assertFails(comment(as(env, 'bob'), 'bob', { courseId: 'draft' }));
    await assertFails(comment(as(env, 'banned'), 'banned', { authorName: 'Тестовый автор' }));
    await assertFails(comment(anon(env), 'x'));
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

  it('снять можно свою; чужую — только автор курса или админ', async () => {
    const seedReaction = () => seed(env, 'courses/pub/reactions/carol_lesson_l1', { uid: 'carol', targetType: 'lesson', targetId: 'l1', emoji: '👍', createdAt: new Date() });
    await seedReaction();
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/pub/reactions/carol_lesson_l1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'carol'), 'courses/pub/reactions/carol_lesson_l1')));
    await seedReaction();
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/pub/reactions/carol_lesson_l1')));
  });

  it('реакции на удалённый комментарий может убрать любой вошедший', async () => {
    await seed(env, 'courses/pub/reactions/carol_comment_c1', { uid: 'carol', targetType: 'comment', targetId: 'c1', emoji: '👍', createdAt: new Date() });
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/pub/reactions/carol_comment_c1')));
    await seed(env, 'courses/pub/reactions/carol_comment_gone', { uid: 'carol', targetType: 'comment', targetId: 'gone', emoji: '👍', createdAt: new Date() });
    await assertSucceeds(deleteDoc(doc(as(env, 'bob'), 'courses/pub/reactions/carol_comment_gone')));
  });

  it('забаненный и аноним не ставят реакции', async () => {
    await assertFails(setDoc(doc(as(env, 'banned'), 'courses/pub/reactions/banned_lesson_l1'), reaction('banned', 'lesson', 'l1')));
    await assertFails(setDoc(doc(anon(env), 'courses/pub/reactions/x_lesson_l1'), reaction('x', 'lesson', 'l1')));
  });
});

describe('удаление опубликованного курса автором (courseService.deleteCourse)', () => {
  it('каскад в разрешённом порядке: обсуждение → снимок → контент → курс', async () => {
    await seed(env, 'courses/pub/reactions/carol_lesson_l1', { uid: 'carol', targetType: 'lesson', targetId: 'l1', emoji: '👍', createdAt: new Date() });
    await seed(env, 'courses/pub/lessons/l1', { title: 'Урок', blocks: [], updatedAt: new Date() });
    await seed(env, 'courses/pub/ratings/carol', { value: 'like', updatedAt: new Date() });
    const db = as(env, 'alice');
    for (const d of (await getDocs(collection(db, 'courses/pub/comments'))).docs) await assertSucceeds(deleteDoc(d.ref));
    for (const d of (await getDocs(collection(db, 'courses/pub/reactions'))).docs) await assertSucceeds(deleteDoc(d.ref));
    await assertSucceeds(deleteDoc(doc(db, 'publicCourses/pub/lessons/l1')));
    await assertSucceeds(deleteDoc(doc(db, 'publicCourses/pub')));
    await assertSucceeds(deleteDoc(doc(db, 'courses/pub/lessons/l1')));
    // Чужие голоса автор не видит, но удалить уже снятого с публикации курса может.
    await assertFails(getDocs(collection(db, 'courses/pub/ratings')));
    await assertSucceeds(deleteDoc(doc(db, 'courses/pub/ratings/carol')));
    await assertSucceeds(deleteDoc(doc(db, 'courses/pub')));
  });

  it('посторонний не может ничего из этого', async () => {
    const db = as(env, 'carol');
    await assertFails(deleteDoc(doc(db, 'courses/pub/comments/c1')));
    await assertFails(deleteDoc(doc(db, 'publicCourses/pub/lessons/l1')));
    await assertFails(deleteDoc(doc(db, 'publicCourses/pub')));
    await assertFails(deleteDoc(doc(db, 'courses/pub')));
  });
});
