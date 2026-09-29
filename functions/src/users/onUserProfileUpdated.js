// При смене отображаемого имени обновляет authorName в опубликованных курсах
// автора (снимок хранит имя, чтобы каталог не читал users на каждую карточку).
// Комментарии хранят имя на момент написания и не переписываются.
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { COLLECTIONS } from '../../shared/schema.js';
import { db } from '../admin.js';

export const onUserProfileUpdated = onDocumentUpdated(`${COLLECTIONS.USERS}/{uid}`, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.displayName === after.displayName) return;
  const courses = await db.collection(COLLECTIONS.PUBLIC_COURSES).where('authorId', '==', event.params.uid).get();
  const writer = db.bulkWriter();
  for (const doc of courses.docs) writer.update(doc.ref, { authorName: after.displayName });
  await writer.close();
});
