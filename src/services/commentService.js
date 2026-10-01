/**
 * Комментарии к опубликованному курсу. Комментарий создаётся одной пакетной
 * записью с отметкой rateLimits.addComment — правила пропускают не чаще раза
 * в 15 с и сверяют имя автора с его профилем. Вместе с комментарием пишется
 * commentAuthors/{id} — по нему считается число комментариев пользователя.
 * Комментарии к уроку (v2, lessonId) хранятся в courses/{id}/lessonComments.
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
/** Сколько комментариев урока загружается (запрос без orderBy — без составного индекса). */
export const LESSON_COMMENTS_MAX = 300;

const commentsCol = (courseId, lessonId = null) =>
  collection(db, COLLECTIONS.COURSES, courseId, lessonId ? SUBCOLLECTIONS.LESSON_COMMENTS : SUBCOLLECTIONS.COMMENTS);
const lessonQuery = (courseId, lessonId) => query(commentsCol(courseId, lessonId), where('lessonId', '==', lessonId));
const millis = (value) => value?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
const authorRef = (commentId) => doc(db, COLLECTIONS.COMMENT_AUTHORS, commentId);

/** Добавляет в пакет удаление комментария вместе с записью о его авторе. */
export function deleteCommentInBatch(batch, commentRef) {
  batch.delete(commentRef);
  batch.delete(authorRef(commentRef.id));
}

/** Комментарии курса или, если указан lessonId, урока — новые сверху. */
export function subscribeToComments(courseId, count, onData, onError, lessonId = null) {
  if (lessonId) {
    // orderBy вместе с where по lessonId потребовал бы составной индекс — сортируем в браузере.
    return onSnapshot(
      query(lessonQuery(courseId, lessonId), limit(LESSON_COMMENTS_MAX)),
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        onData(all.sort((a, b) => millis(b.createdAt) - millis(a.createdAt)).slice(0, count));
      },
      onError,
    );
  }
  const q = query(commentsCol(courseId), orderBy('createdAt', 'desc'), limit(count));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Число комментариев курса или урока (агрегирующий запрос, один «read» на 1000 документов). */
export async function countComments(courseId, lessonId = null) {
  const q = lessonId ? lessonQuery(courseId, lessonId) : commentsCol(courseId);
  return (await getCountFromServer(q)).data().count;
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
export async function addComment(courseId, author, text, lessonId = null) {
  const ref = doc(commentsCol(courseId, lessonId));
  const batch = writeBatch(db);
  batch.set(ref, {
    authorId: author.uid,
    authorName: author.displayName,
    ...(lessonId && { lessonId }),
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
  batch.set(authorRef(ref.id), { authorId: author.uid, courseId, ...(lessonId && { kind: 'lesson' }) });
  stampRateLimit(batch, author.uid, 'addComment');
  await withRateLimit(author.uid, 'addComment', RATE_LIMITS.ADD_COMMENT_SECONDS, () => batch.commit());
  return ref.id;
}

/** Удаляет комментарий и реакции на него (правила разрешают убрать реакции удалённого комментария). */
export async function deleteComment(courseId, commentId, lessonId = null) {
  const batch = writeBatch(db);
  deleteCommentInBatch(batch, doc(commentsCol(courseId, lessonId), commentId));
  await batch.commit();
  const reactions = query(
    collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.REACTIONS),
    where('targetType', '==', lessonId ? 'lessonComment' : 'comment'),
    where('targetId', '==', commentId),
  );
  await deleteAllDocs(reactions).catch(() => {
    // Уборка реакций не критична: без комментария они нигде не показываются.
  });
}
