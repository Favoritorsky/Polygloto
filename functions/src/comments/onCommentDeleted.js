// После удаления комментария: пересчитать счётчики курса и автора комментария
// и убрать реакции на него. Счётчики пересчитываются count()-запросами, а не
// уменьшаются на 1: повторная доставка события их не испортит, а удалённый
// модератором спам перестаёт засчитываться в бейдж «Собеседник».
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from '../admin.js';

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
    const authorId = event.data?.data()?.authorId;
    const [courseCount, authorCount] = await Promise.all([
      db.collection(COLLECTIONS.COURSES).doc(courseId).collection(SUBCOLLECTIONS.COMMENTS).count().get(),
      authorId ? db.collectionGroup(SUBCOLLECTIONS.COMMENTS).where('authorId', '==', authorId).count().get() : null,
    ]);
    // Курс или автор могли быть удалены целиком — тогда обновлять нечего.
    const ignoreMissing = (error) => {
      if (error.code !== 5 /* NOT_FOUND */) throw error;
    };
    await Promise.all([
      publicRef.update({ commentsCount: courseCount.data().count }).catch(ignoreMissing),
      authorCount &&
        db.collection(COLLECTIONS.USERS).doc(authorId).update({ commentsCount: authorCount.data().count }).catch(ignoreMissing),
    ]);
  },
);
