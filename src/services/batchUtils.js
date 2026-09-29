/** Пакетные операции Firestore (лимит — 500 записей на пакет). */
import { getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';

export const BATCH_SIZE = 400;

/** Удаляет все документы коллекции (или запроса) порциями. */
export async function deleteAllDocs(collectionOrQuery) {
  const snap = await getDocs(collectionOrQuery);
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
