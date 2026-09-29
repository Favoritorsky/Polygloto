// Повышает reader → user после подтверждения email.
// Статус подтверждения берётся только из подписанного токена (auth.token.email_verified).
import { onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS, ROLES } from '../../shared/schema.js';
import { db } from '../admin.js';
import { requireAuth } from '../lib/guards.js';

export const syncRole = onCall(async (request) => {
  const auth = requireAuth(request);
  const ref = db.collection(COLLECTIONS.USERS).doc(auth.uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { role: null };
    const { role } = snap.data();
    if (role === ROLES.READER && auth.token.email_verified === true) {
      tx.update(ref, { role: ROLES.USER });
      return { role: ROLES.USER };
    }
    return { role };
  });
});
