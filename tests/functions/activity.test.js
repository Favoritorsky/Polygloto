import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { afterEach, describe, expect, it } from 'vitest';
import { CALLABLES } from '../../shared/schema.js';
import { adminDb, createClient, signUp, waitFor } from './helpers.js';

const clients = [];
function client() {
  const c = createClient();
  clients.push(c);
  return c;
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

async function seedPublished(authorId = 'someone') {
  const id = `pub${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  await adminDb.doc(`courses/${id}`).set({ authorId, status: 'published', hasPublishedVersion: true });
  await adminDb.doc(`publicCourses/${id}`).set({ authorId, title: 'Курс', likesCount: 0, dislikesCount: 0, score: 0, commentsCount: 0 });
  return id;
}

describe('addComment', () => {
  it('создаёт комментарий, увеличивает счётчики; второй сразу — rate limit', async () => {
    const c = client();
    const user = await signUp(c);
    const courseId = await seedPublished();
    const { commentId } = await c.call(CALLABLES.ADD_COMMENT, { courseId, text: '  Отличный курс!  ' });
    const comment = (await adminDb.doc(`courses/${courseId}/comments/${commentId}`).get()).data();
    expect(comment).toMatchObject({ authorId: user.uid, text: 'Отличный курс!' });
    expect((await adminDb.doc(`publicCourses/${courseId}`).get()).get('commentsCount')).toBe(1);
    expect((await adminDb.doc(`users/${user.uid}`).get()).get('commentsCount')).toBe(1);
    await expect(c.call(CALLABLES.ADD_COMMENT, { courseId, text: 'Ещё' })).rejects.toMatchObject({ code: 'functions/resource-exhausted' });
  });

  it('пустой, слишком длинный, к неопубликованному — отказ', async () => {
    const c = client();
    await signUp(c);
    const courseId = await seedPublished();
    await expect(c.call(CALLABLES.ADD_COMMENT, { courseId, text: '   ' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(c.call(CALLABLES.ADD_COMMENT, { courseId, text: 'x'.repeat(2001) })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    await expect(c.call(CALLABLES.ADD_COMMENT, { courseId: 'nope', text: 'Привет' })).rejects.toMatchObject({ code: 'functions/not-found' });
    // Путь вместо id: без проверки комментарий записался бы во вложенный документ.
    for (const bad of [`${courseId}/lessons/l1`, '..', '', 42]) {
      await expect(c.call(CALLABLES.ADD_COMMENT, { courseId: bad, text: 'Привет' })).rejects.toMatchObject({ code: 'functions/invalid-argument' });
    }
  });

  it('удаление комментария пересчитывает счётчики курса и автора и убирает реакции', async () => {
    const c = client();
    const user = await signUp(c);
    const courseId = await seedPublished();
    const { commentId } = await c.call(CALLABLES.ADD_COMMENT, { courseId, text: 'Привет' });
    await setDoc(doc(c.db, `courses/${courseId}/reactions/${user.uid}_comment_${commentId}`), {
      uid: user.uid, targetType: 'comment', targetId: commentId, emoji: '👍', createdAt: serverTimestamp(),
    });
    await deleteDoc(doc(c.db, `courses/${courseId}/comments/${commentId}`));
    await waitFor(async () => (await adminDb.doc(`publicCourses/${courseId}`).get()).get('commentsCount') === 0);
    await waitFor(async () => (await adminDb.doc(`users/${user.uid}`).get()).get('commentsCount') === 0);
    await waitFor(async () => !(await adminDb.doc(`courses/${courseId}/reactions/${user.uid}_comment_${commentId}`).get()).exists);
  });
});

describe('onRatingWritten', () => {
  it('пересчитывает лайки и дизлайки, учитывает смену и снятие голоса', async () => {
    const courseId = await seedPublished();
    const a = client();
    const ua = await signUp(a);
    const b = client();
    const ub = await signUp(b);
    const counts = async () => {
      const d = (await adminDb.doc(`publicCourses/${courseId}`).get()).data();
      return [d.likesCount, d.dislikesCount, d.score];
    };
    await setDoc(doc(a.db, `courses/${courseId}/ratings/${ua.uid}`), { value: 'like', updatedAt: serverTimestamp() });
    await setDoc(doc(b.db, `courses/${courseId}/ratings/${ub.uid}`), { value: 'like', updatedAt: serverTimestamp() });
    await waitFor(async () => (await counts()).join() === '2,0,2');
    await setDoc(doc(b.db, `courses/${courseId}/ratings/${ub.uid}`), { value: 'dislike', updatedAt: serverTimestamp() });
    await waitFor(async () => (await counts()).join() === '1,1,0');
    await deleteDoc(doc(a.db, `courses/${courseId}/ratings/${ua.uid}`));
    await waitFor(async () => (await counts()).join() === '0,1,-1');
  });
});
