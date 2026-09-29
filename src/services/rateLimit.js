/**
 * Ограничение частоты действий без Cloud Functions. Отметка времени
 * rateLimits/{uid}.{action} пишется в той же пакетной записи, что и само
 * действие; правила требуют, чтобы она стала равна времени записи, и
 * отклоняют её, если с прошлой прошло меньше N секунд. Здесь — только
 * предварительная проверка, чтобы показать понятное сообщение без лишнего запроса.
 */
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS } from '../../shared/schema.js';
import { UserFacingError } from './errors.js';
import { db } from './firebase.js';

const limitRef = (uid) => doc(db, COLLECTIONS.RATE_LIMITS, uid);

export function tooOftenError(seconds) {
  return new UserFacingError(`Слишком часто. Попробуйте через ${Math.max(1, Math.ceil(seconds))} с.`);
}

/** Бросает понятную ошибку, если действие было меньше seconds секунд назад. */
export async function assertRateLimit(uid, action, seconds) {
  const snap = await getDoc(limitRef(uid));
  const last = snap.exists() ? snap.data()[action]?.toMillis?.() : null;
  if (last) {
    const wait = seconds - (Date.now() - last) / 1000;
    if (wait > 0) throw tooOftenError(wait);
  }
}

/** Добавляет в пакетную запись отметку действия. */
export function stampRateLimit(batch, uid, action) {
  batch.set(limitRef(uid), { [action]: serverTimestamp() }, { merge: true });
}

/**
 * Если правила отклонили запись из-за лимита (часы клиента и сервера могут
 * расходиться), превращает отказ в то же понятное сообщение.
 */
export async function withRateLimit(uid, action, seconds, write) {
  await assertRateLimit(uid, action, seconds);
  try {
    return await write();
  } catch (error) {
    if (error?.code === 'permission-denied') {
      const snap = await getDoc(limitRef(uid)).catch(() => null);
      const last = snap?.exists() ? snap.data()[action]?.toMillis?.() : null;
      if (last && Date.now() - last < seconds * 1000 + 5000) throw tooOftenError(seconds - (Date.now() - last) / 1000);
    }
    throw error;
  }
}
