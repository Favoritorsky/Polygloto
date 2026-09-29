/** Комментарии к опубликованному курсу. Создание — через Cloud Function (rate limit). */
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CALLABLES, COLLECTIONS, LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, functions } from './firebase.js';

export const COMMENTS_PAGE = 30;

export function subscribeToComments(courseId, count, onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.COMMENTS),
    orderBy('createdAt', 'desc'),
    limit(count),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function validateComment(text) {
  const trimmed = text.trim();
  if (trimmed.length < LIMITS.COMMENT_MIN) return 'Напишите что-нибудь.';
  if (trimmed.length > LIMITS.COMMENT_MAX) return `Не больше ${LIMITS.COMMENT_MAX} символов.`;
  return null;
}

export function addComment(courseId, text) {
  return httpsCallable(functions, CALLABLES.ADD_COMMENT)({ courseId, text: text.trim() });
}

export function deleteComment(courseId, commentId) {
  return deleteDoc(doc(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.COMMENTS, commentId));
}
