/** Данные публичного профиля: опубликованные курсы автора. */
import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

const AUTHOR_COURSES_MAX = 100;

/** Опубликованные курсы автора, лучшие сверху (сортировка на клиенте — без составного индекса). */
export function subscribeToAuthorCourses(uid, onData, onError) {
  return onSnapshot(
    query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('authorId', '==', uid), limit(AUTHOR_COURSES_MAX)),
    (snap) =>
      onData(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.likesCount ?? 0) - (a.likesCount ?? 0)),
      ),
    onError,
  );
}
