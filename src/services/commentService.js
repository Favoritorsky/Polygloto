/**
 * Комментарии к опубликованному курсу. Комментарий создаётся одной пакетной
 * записью с отметкой rateLimits.addComment — правила пропускают не чаще раза
 * в 15 с и сверяют имя автора с его профилем. Вместе с комментарием пишется
 * commentAuthors/{id} — по нему считается число комментариев пользователя.
 */
import {
  collection,
  doc,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, LIMITS, RATE_LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { deleteAllDocs } from './batchUtils.js';
import { db } from './firebase.js';
import { stampRateLimit, withRateLimit } from './rateLimit.js';

export const COMMENTS_PAGE = 30;

const commentsCol = (courseId) => collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.COMMENTS);
const authorRef = (commentId) => doc(db, COLLECTIONS.COMMENT_AUTHORS, commentId);

/** Добавляет в пакет удаление комментария вместе с записью о его авторе. */
export function deleteCommentInBatch(batch, commentRef) {
  batch.delete(commentRef);
  batch.delete(authorRef(commentRef.id));
}

export function subscribeToComments(courseId, count, onData, onError) {
  const q = query(commentsCol(courseId), orderBy('createdAt', 'desc'), limit(count));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Число комментариев курса (агрегирующий запрос, один «read» на 1000 документов). */
export async function countComments(courseId) {
  return (await getCountFromServer(commentsCol(courseId))).data().count;
}

/** Сколько комментариев написал пользователь (для бейджа «Собеседник»). */
export async function countUserComments(uid) {
  const q = query(collection(db, COLLECTIONS.COMMENT_AUTHORS), where('authorId', '==', uid));
  return (await getCountFromServer(q)).data().count;
}

export function validateComment(text) {
  const trimmed = text.trim();
  if (trimmed.length < LIMITS.COMMENT_MIN) return 'Напишите что-нибудь.';
  if (trimmed.length > LIMITS.COMMENT_MAX) return `Не больше ${LIMITS.COMMENT_MAX} символов.`;
  return null;
}

/** author: { uid, displayName } — имя должно совпадать с профилем (проверяют правила). */
export async function addComment(courseId, author, text) {
  const ref = doc(commentsCol(courseId));
  const batch = writeBatch(db);
  batch.set(ref, { authorId: author.uid, authorName: author.displayName, text: text.trim(), createdAt: serverTimestamp() });
  batch.set(authorRef(ref.id), { authorId: author.uid, courseId });
  stampRateLimit(batch, author.uid, 'addComment');
  await withRateLimit(author.uid, 'addComment', RATE_LIMITS.ADD_COMMENT_SECONDS, () => batch.commit());
  return ref.id;
}

/** Удаляет комментарий и реакции на него (правила разрешают убрать реакции удалённого комментария). */
export async function deleteComment(courseId, commentId) {
  const batch = writeBatch(db);
  deleteCommentInBatch(batch, doc(commentsCol(courseId), commentId));
  await batch.commit();
  const reactions = query(
    collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.REACTIONS),
    where('targetType', '==', 'comment'),
    where('targetId', '==', commentId),
  );
  await deleteAllDocs(reactions).catch(() => {
    // Уборка реакций не критична: без комментария они нигде не показываются.
  });
}
