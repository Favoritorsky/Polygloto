/**
 * Оценка курса «нравится / не нравится»: один документ на пользователя
 * courses/{id}/ratings/{uid}. Без Cloud Functions счётчики в publicCourses
 * меняются той же транзакцией ровно на разницу голоса; правила сверяют голос
 * и счётчики друг с другом, поэтому накрутить их нельзя.
 */
import { doc, increment, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

const ratingRef = (courseId, uid) => doc(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.RATINGS, uid);

export function subscribeToMyRating(courseId, uid, onData, onError) {
  return onSnapshot(ratingRef(courseId, uid), (snap) => onData(snap.exists() ? snap.data().value : null), onError);
}

/** Разница счётчиков при смене голоса before → after (null — голоса нет). */
export function ratingDelta(before, after) {
  const likes = (after === 'like' ? 1 : 0) - (before === 'like' ? 1 : 0);
  const dislikes = (after === 'dislike' ? 1 : 0) - (before === 'dislike' ? 1 : 0);
  return { likes, dislikes, score: likes - dislikes };
}

/** value: 'like' | 'dislike' | null (снять оценку). */
export async function setMyRating(courseId, uid, value) {
  const ref = ratingRef(courseId, uid);
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const before = snap.exists() ? snap.data().value : null;
    const after = value ?? null;
    if (before === after) return;
    if (after) tx.set(ref, { value: after, updatedAt: serverTimestamp() });
    else tx.delete(ref);
    const d = ratingDelta(before, after);
    // increment: одновременные голоса разных читателей не затирают друг друга.
    tx.update(publicRef, {
      likesCount: increment(d.likes),
      dislikesCount: increment(d.dislikes),
      score: increment(d.score),
    });
  });
}
