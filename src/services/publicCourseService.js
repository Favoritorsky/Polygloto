/** Опубликованные курсы (publicCourses) — только чтение. */
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

export function subscribeToPublicCourse(courseId, onData, onError) {
  return onSnapshot(
    doc(db, COLLECTIONS.PUBLIC_COURSES, courseId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

const KIND_COLLECTION = { lessons: SUBCOLLECTIONS.LESSONS, reference: SUBCOLLECTIONS.REFERENCE };

export async function getPublicSection(courseId, kind, sectionId) {
  const snap = await getDoc(doc(db, COLLECTIONS.PUBLIC_COURSES, courseId, KIND_COLLECTION[kind], sectionId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
