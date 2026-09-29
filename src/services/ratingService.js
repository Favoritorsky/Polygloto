/**
 * Оценка курса «нравится / не нравится»: один документ на пользователя
 * courses/{id}/ratings/{uid}. Счётчики пересчитывает Cloud Function.
 */
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

const ratingRef = (courseId, uid) => doc(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.RATINGS, uid);

export function subscribeToMyRating(courseId, uid, onData, onError) {
  return onSnapshot(ratingRef(courseId, uid), (snap) => onData(snap.exists() ? snap.data().value : null), onError);
}

/** value: 'like' | 'dislike' | null (снять оценку). */
export function setMyRating(courseId, uid, value) {
  if (!value) return deleteDoc(ratingRef(courseId, uid));
  return setDoc(ratingRef(courseId, uid), { value, updatedAt: serverTimestamp() });
}
