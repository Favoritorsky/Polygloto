// Триггер Auth: при регистрации создаёт users/{uid} с ролью reader.
// Auth-триггеры onCreate есть только в API v1.
import * as functionsV1 from 'firebase-functions/v1';
import { COLLECTIONS, ROLES } from '../../shared/schema.js';
import { bucket, db, FieldValue } from '../admin.js';
import { REGION } from '../config.js';

/** Имя по умолчанию. Email не используем — он не должен стать публичным. */
export function defaultDisplayName(uid) {
  return `Автор-${uid.slice(0, 6)}`;
}

export const onUserCreated = functionsV1
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const ref = db.collection(COLLECTIONS.USERS).doc(user.uid);
    // create() падает, если документ уже есть — повторная доставка события безопасна.
    try {
      await ref.create({
        displayName: (user.displayName || '').trim().slice(0, 40) || defaultDisplayName(user.uid),
        photoURL: null,
        bio: '',
        role: user.emailVerified ? ROLES.USER : ROLES.READER,
        banned: false,
        commentsCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if (error.code !== 6 /* ALREADY_EXISTS */) throw error;
    }
  });

export const onUserDeleted = functionsV1
  .region(REGION)
  .auth.user()
  .onDelete(async (user) => {
    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(user.uid).delete(),
      db.collection(COLLECTIONS.RATE_LIMITS).doc(user.uid).delete(),
      // Аватары удалённого аккаунта не должны оставаться публичными.
      bucket().deleteFiles({ prefix: `avatars/${user.uid}/` }),
    ]);
  });
