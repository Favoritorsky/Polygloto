import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
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
  for (const uid of ['alice', 'bob', 'carol']) await seed(env, `users/${uid}`, userProfile({ displayName: uid === 'bob' ? 'Боб' : 'Тестовый автор' }));
  await seed(env, 'courses/pub', course({ status: 'published', hasPublishedVersion: true }));
  await seed(env, 'publicCourses/pub', { authorId: 'alice', title: 'Курс' });
  await seed(env, 'publicCourses/pub/lessons/l1', { title: 'Урок', blocks: [] });
  await seed(env, 'courses/draft', course());
});

/** Как commentService.addComment с lessonId: комментарий, отметка автора и лимит одной записью. */
function lessonComment(db, uid, { lessonId = 'l1', courseId = 'pub', id = 'lc1', text = 'Вопрос по уроку', marker, extra = {} } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, `courses/${courseId}/lessonComments/${id}`), { authorId: uid, authorName: 'Боб', lessonId, text, createdAt: serverTimestamp(), ...extra });
  batch.set(doc(db, `rateLimits/${uid}`), { addComment: serverTimestamp() }, { merge: true });
  if (marker !== null) batch.set(doc(db, `commentAuthors/${id}`), marker ?? { authorId: uid, courseId, kind: 'lesson' });
  return batch.commit();
}

const removeLessonComment = (db, id = 'lc1') => {
  const batch = writeBatch(db);
  batch.delete(doc(db, `courses/pub/lessonComments/${id}`));
  batch.delete(doc(db, `commentAuthors/${id}`));
  return batch.commit();
};

describe('комментарии к урокам (v2)', () => {
  it('создаются к уроку опубликованного курса и видны всем', async () => {
    await assertSucceeds(lessonComment(as(env, 'bob'), 'bob'));
    await assertSucceeds(getDocs(query(collection(anon(env), 'courses/pub/lessonComments'), where('lessonId', '==', 'l1'))));
  });

  it('нельзя: к несуществующему уроку, к черновику, без отметки, с отметкой другого вида, с лишним полем', async () => {
    const db = as(env, 'bob');
    await assertFails(lessonComment(db, 'bob', { lessonId: 'nope' }));
    await assertFails(lessonComment(db, 'bob', { courseId: 'draft' }));
    await assertFails(lessonComment(db, 'bob', { marker: null }));
    await assertFails(lessonComment(db, 'bob', { marker: { authorId: 'bob', courseId: 'pub' } }));
    await assertFails(lessonComment(db, 'bob', { marker: { authorId: 'bob', courseId: 'pub', kind: 'other' } }));
    await assertFails(lessonComment(db, 'bob', { extra: { html: '<b>' } }));
    await assertFails(lessonComment(anon(env), 'bob'));
  });

  it('удаляет автор комментария, автор курса; чужой — нет; только вместе с отметкой', async () => {
    await lessonComment(as(env, 'bob'), 'bob');
    await assertFails(removeLessonComment(as(env, 'carol')));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/pub/lessonComments/lc1')));
    await assertSucceeds(removeLessonComment(as(env, 'alice')));
  });

  it('реакции на комментарий к уроку; уборка реакций удалённого комментария', async () => {
    await lessonComment(as(env, 'bob'), 'bob');
    const id = 'carol_lessonComment_lc1';
    const reaction = { uid: 'carol', targetType: 'lessonComment', targetId: 'lc1', emoji: '👍', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as(env, 'carol'), `courses/pub/reactions/${id}`), reaction));
    await assertFails(setDoc(doc(as(env, 'carol'), 'courses/pub/reactions/carol_lessonComment_zz'), { ...reaction, targetId: 'zz' }));
    await assertFails(deleteDoc(doc(as(env, 'bob'), `courses/pub/reactions/${id}`)));
    await removeLessonComment(as(env, 'bob'));
    await assertSucceeds(deleteDoc(doc(as(env, 'bob'), `courses/pub/reactions/${id}`)));
  });
});
