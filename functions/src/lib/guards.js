// Общие проверки для callable-функций. Никогда не доверяем данным клиента:
// роль и бан читаем из users/{uid} на сервере, email_verified — из токена.
import { HttpsError } from 'firebase-functions/v2/https';
import { COLLECTIONS, ROLES } from '../../shared/schema.js';
import { db } from '../admin.js';

export function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Войдите в аккаунт.');
  }
  return request.auth;
}

export async function getUserDoc(uid) {
  const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/** Требует входа и отсутствия бана. Возвращает { auth, user }. */
export async function requireActiveUser(request) {
  const auth = requireAuth(request);
  const user = await getUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('failed-precondition', 'Профиль ещё создаётся, попробуйте через пару секунд.');
  }
  if (user.banned === true) {
    throw new HttpsError('permission-denied', 'Аккаунт заблокирован администратором.');
  }
  return { auth, user };
}

export async function requireAdmin(request) {
  const { auth, user } = await requireActiveUser(request);
  if (user.role !== ROLES.ADMIN) {
    throw new HttpsError('permission-denied', 'Действие доступно только администратору.');
  }
  return { auth, user };
}

/** Проверка строки: тип и длина (после trim). */
export function requireString(value, field, { min = 0, max }) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `Поле «${field}» должно быть строкой.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpsError('invalid-argument', `Длина поля «${field}»: от ${min} до ${max} символов.`);
  }
  return trimmed;
}
