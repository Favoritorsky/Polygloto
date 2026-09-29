/**
 * Документы users/{uid}. Роль/бан клиент не пишет никогда — правила это запрещают,
 * а здесь updateOwnProfile принимает только разрешённые поля.
 */
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { COLLECTIONS, LIMITS } from '../../shared/schema.js';
import { db } from './firebase.js';

const userRef = (uid) => doc(db, COLLECTIONS.USERS, uid);

export function subscribeToUser(uid, onData, onError) {
  return onSnapshot(
    userRef(uid),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

/** Ждёт появления users/{uid} (его создаёт триггер после регистрации). */
export function waitForUserDoc(uid, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Profile creation timed out'));
    }, timeoutMs);
    unsubscribe = onSnapshot(
      userRef(uid),
      (snap) => {
        if (snap.exists()) {
          clearTimeout(timer);
          unsubscribe();
          resolve(snap.data());
        }
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Клиентская валидация полей профиля (дублирует firestore.rules). */
export function validateProfile({ displayName, bio }) {
  const errors = {};
  if (displayName !== undefined) {
    const name = displayName.trim();
    if (name.length < LIMITS.DISPLAY_NAME_MIN || name.length > LIMITS.DISPLAY_NAME_MAX) {
      errors.displayName = `Имя: от ${LIMITS.DISPLAY_NAME_MIN} до ${LIMITS.DISPLAY_NAME_MAX} символов.`;
    }
  }
  if (bio !== undefined && bio.length > LIMITS.BIO_MAX) {
    errors.bio = `Не больше ${LIMITS.BIO_MAX} символов.`;
  }
  return errors;
}

/** Обновляет только разрешённые поля собственного профиля. */
export function updateOwnProfile(uid, { displayName, bio, photoURL }) {
  const patch = {};
  if (displayName !== undefined) patch.displayName = displayName.trim();
  if (bio !== undefined) patch.bio = bio;
  if (photoURL !== undefined) patch.photoURL = photoURL;
  return updateDoc(userRef(uid), patch);
}
