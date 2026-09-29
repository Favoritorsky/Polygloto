// Бан / разбан пользователя. Только админ; нельзя забанить себя или другого админа.
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS, ROLES } from '../../shared/schema.js';
import { db } from '../admin.js';
import { requireAdmin, requireDocId } from '../lib/guards.js';

export const setUserBan = onCall(async (request) => {
  const { auth } = await requireAdmin(request);
  const { uid, banned } = request.data ?? {};
  requireDocId(uid, 'пользователь');
  if (typeof banned !== 'boolean') {
    throw new HttpsError('invalid-argument', 'Нужны uid и banned.');
  }
  if (uid === auth.uid) throw new HttpsError('failed-precondition', 'Нельзя заблокировать самого себя.');
  const ref = db.collection(COLLECTIONS.USERS).doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Пользователь не найден.');
    if (snap.get('role') === ROLES.ADMIN) throw new HttpsError('failed-precondition', 'Администратора заблокировать нельзя.');
    tx.update(ref, { banned });
  });
  return { uid, banned };
});
