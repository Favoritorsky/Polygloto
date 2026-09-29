// После удаления комментария: уменьшить счётчик курса и убрать реакции на него.
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, FieldValue } from '../admin.js';

export const onCommentDeleted = onDocumentDeleted(
  `${COLLECTIONS.COURSES}/{courseId}/${SUBCOLLECTIONS.COMMENTS}/{commentId}`,
  async (event) => {
    const { courseId, commentId } = event.params;
    const publicRef = db.collection(COLLECTIONS.PUBLIC_COURSES).doc(courseId);
    const reactions = await db
      .collection(COLLECTIONS.COURSES)
      .doc(courseId)
      .collection(SUBCOLLECTIONS.REACTIONS)
      .where('targetType', '==', 'comment')
      .where('targetId', '==', commentId)
      .get();
    const writer = db.bulkWriter();
    reactions.docs.forEach((d) => writer.delete(d.ref));
    await writer.close();
    // Курс мог быть удалён целиком — тогда счётчик обновлять не нужно.
    const publicSnap = await publicRef.get();
    if (publicSnap.exists) await publicRef.update({ commentsCount: FieldValue.increment(-1) });
  },
);
