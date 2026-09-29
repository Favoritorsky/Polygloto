// Простой rate limiting: «не чаще раза в N секунд» на пользователя и действие.
// Отметка хранится в rateLimits/{uid} (клиенту коллекция закрыта правилами).
import { HttpsError } from 'firebase-functions/v2/https';
import { COLLECTIONS } from '../../shared/schema.js';
import { db, Timestamp } from '../admin.js';

/**
 * Атомарно проверяет и обновляет отметку времени внутри переданной транзакции.
 * Бросает resource-exhausted, если с прошлого действия прошло меньше seconds.
 */
export async function enforceRateLimit(tx, uid, action, seconds) {
  const ref = db.collection(COLLECTIONS.RATE_LIMITS).doc(uid);
  const snap = await tx.get(ref);
  const last = snap.exists ? snap.get(action) : null;
  const now = Timestamp.now();
  if (last && now.toMillis() - last.toMillis() < seconds * 1000) {
    const wait = Math.ceil((seconds * 1000 - (now.toMillis() - last.toMillis())) / 1000);
    throw new HttpsError('resource-exhausted', `Слишком часто. Попробуйте через ${wait} с.`);
  }
  return () => tx.set(ref, { [action]: now }, { merge: true });
}
