// При удалении рабочей версии курса удаляем все его подколлекции
// и опубликованную копию, чтобы не оставалось «осиротевших» данных.
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { COLLECTIONS } from '../../shared/schema.js';
import { db } from '../admin.js';

export const onCourseDeleted = onDocumentDeleted(`${COLLECTIONS.COURSES}/{courseId}`, async (event) => {
  const { courseId } = event.params;
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);
  const publicRef = db.collection(COLLECTIONS.PUBLIC_COURSES).doc(courseId);
  // recursiveDelete удаляет документ и все вложенные подколлекции.
  await Promise.all([db.recursiveDelete(courseRef), db.recursiveDelete(publicRef)]);
});
