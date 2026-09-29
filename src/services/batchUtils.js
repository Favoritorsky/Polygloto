/** Пакетные операции Firestore (лимит — 500 записей на пакет). */
import { getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase.js';

export const BATCH_SIZE = 400;

/**
 * Удаляет все документы коллекции (или запроса) порциями. deleteOne(batch, ref)
 * позволяет удалить вместе с документом связанные (не больше одного на документ,
 * поэтому порция — половина лимита).
 */
export async function deleteAllDocs(collectionOrQuery, deleteOne = (batch, ref) => batch.delete(ref)) {
  const snap = await getDocs(collectionOrQuery);
  const size = BATCH_SIZE / 2;
  for (let i = 0; i < snap.docs.length; i += size) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + size).forEach((d) => deleteOne(batch, d.ref));
    await batch.commit();
  }
}
