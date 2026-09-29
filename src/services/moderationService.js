/**
 * Админ-панель: очередь модерации, решения, пользователи.
 * Решения принимает только Cloud Function (moderateCourse / setUserBan),
 * здесь — лишь вызовы и чтение.
 */
import { collection, getDocs, limit, onSnapshot, orderBy, query, where, startAt, endAt } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CALLABLES, COLLECTIONS, COURSE_STATUS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, functions } from './firebase.js';

export function subscribeToReviewQueue(onData, onError) {
  const q = query(
    collection(db, COLLECTIONS.COURSES),
    where('status', '==', COURSE_STATUS.PENDING_REVIEW),
    orderBy('submittedAt', 'asc'),
  );
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function subscribeToAllCourses(onData, onError) {
  const q = query(collection(db, COLLECTIONS.COURSES), orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Весь контент рабочей версии для просмотра модератором. */
export async function loadCourseContent(courseId) {
  const read = async (name) => {
    const snap = await getDocs(collection(db, COLLECTIONS.COURSES, courseId, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  };
  const [lessons, reference, dictionary] = await Promise.all([
    read(SUBCOLLECTIONS.LESSONS),
    read(SUBCOLLECTIONS.REFERENCE),
    read(SUBCOLLECTIONS.DICTIONARY),
  ]);
  return { lessons, reference, dictionary };
}

export function approveCourse(courseId) {
  return httpsCallable(functions, CALLABLES.MODERATE_COURSE)({ courseId, decision: 'approve' });
}

export function rejectCourse(courseId, reason) {
  return httpsCallable(functions, CALLABLES.MODERATE_COURSE)({ courseId, decision: 'reject', reason });
}

/** Поиск пользователей по началу имени (регистрозависимо — ограничение Firestore). */
export async function searchUsers(prefix) {
  const base = collection(db, COLLECTIONS.USERS);
  const q = prefix
    ? query(base, orderBy('displayName'), startAt(prefix), endAt(`${prefix}`), limit(50))
    : query(base, orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function setUserBan(uid, banned) {
  return httpsCallable(functions, CALLABLES.SET_USER_BAN)({ uid, banned });
}
