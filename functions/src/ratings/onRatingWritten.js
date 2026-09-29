// Пересчёт likesCount / dislikesCount по подколлекции ratings.
// Клиент счётчики не трогает (правила запрещают), поэтому накрутить нельзя:
// один документ оценки на пользователя, а агрегат считается сервером.
// Пересчёт count()-запросами идемпотентен (триггер может сработать повторно).
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from '../admin.js';

export const onRatingWritten = onDocumentWritten(
  `${COLLECTIONS.COURSES}/{courseId}/${SUBCOLLECTIONS.RATINGS}/{uid}`,
  async (event) => {
    const { courseId } = event.params;
    const ratings = db.collection(COLLECTIONS.COURSES).doc(courseId).collection(SUBCOLLECTIONS.RATINGS);
    const [likes, dislikes] = await Promise.all([
      ratings.where('value', '==', 'like').count().get(),
      ratings.where('value', '==', 'dislike').count().get(),
    ]);
    const likesCount = likes.data().count;
    const dislikesCount = dislikes.data().count;
    const publicRef = db.collection(COLLECTIONS.PUBLIC_COURSES).doc(courseId);
    const snap = await publicRef.get();
    if (!snap.exists) return;
    await publicRef.update({ likesCount, dislikesCount, score: likesCount - dislikesCount });
  },
);
