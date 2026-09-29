// Добавление комментария к опубликованному курсу.
// Через функцию, чтобы работал rate limit и автор/время выставлялись сервером.
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS, LIMITS, RATE_LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, FieldValue } from '../admin.js';
import { requireActiveUser, requireString } from '../lib/guards.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

export const addComment = onCall(async (request) => {
  const { auth, user } = await requireActiveUser(request);
  const { courseId } = request.data ?? {};
  if (typeof courseId !== 'string' || !courseId) throw new HttpsError('invalid-argument', 'Не указан курс.');
  const text = requireString(request.data?.text, 'Комментарий', { min: LIMITS.COMMENT_MIN, max: LIMITS.COMMENT_MAX });

  const publicRef = db.collection(COLLECTIONS.PUBLIC_COURSES).doc(courseId);
  const commentRef = db.collection(COLLECTIONS.COURSES).doc(courseId).collection(SUBCOLLECTIONS.COMMENTS).doc();
  const userRef = db.collection(COLLECTIONS.USERS).doc(auth.uid);

  await db.runTransaction(async (tx) => {
    const publicSnap = await tx.get(publicRef);
    if (!publicSnap.exists) throw new HttpsError('not-found', 'Курс не найден или не опубликован.');
    const commitRateLimit = await enforceRateLimit(tx, auth.uid, 'addComment', RATE_LIMITS.ADD_COMMENT_SECONDS);
    tx.create(commentRef, {
      authorId: auth.uid,
      authorName: user.displayName,
      authorPhotoURL: user.photoURL ?? null,
      text,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(publicRef, { commentsCount: FieldValue.increment(1) });
    tx.update(userRef, { commentsCount: FieldValue.increment(1) });
    commitRateLimit();
  });

  return { commentId: commentRef.id };
});
