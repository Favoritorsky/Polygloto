/**
 * Аутентификация: регистрация, вход, подтверждение email, пароль.
 * Компоненты не вызывают firebase/auth напрямую — только через этот модуль.
 */
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { createOwnProfile, promoteToAuthor } from './userService.js';

function actionCodeSettings(path = '/') {
  return { url: `${window.location.origin}${path}` };
}

/** Подписка на смену пользователя и его токена (в т.ч. после reload/verify). */
export function subscribeToAuth(callback) {
  return onIdTokenChanged(auth, callback);
}

/**
 * Регистрация. Профиль users/{uid} создаёт сам клиент (правила разрешают
 * только роль reader и никаких служебных значений). Если запись профиля
 * не удалась, AuthProvider создаст его при следующем входе.
 */
export async function register({ email, password, displayName }) {
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
  // Письмо отправляем сразу, не дожидаясь профиля.
  const verification = sendEmailVerification(user, actionCodeSettings('/account')).catch(() => null);
  try {
    await createOwnProfile(user.uid, { displayName });
  } catch {
    // Профиль будет создан с именем по умолчанию; имя можно сменить в профиле.
  }
  await verification;
  return user;
}

export function login({ email, password }) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export function logout() {
  return signOut(auth);
}

export function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('Not signed in');
  return sendEmailVerification(auth.currentUser, actionCodeSettings('/account'));
}

export function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email.trim(), actionCodeSettings('/login'));
}

/** Смена пароля из настроек: требует подтвердить текущий пароль. */
export async function changePassword({ currentPassword, newPassword }) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('Not signed in');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

/**
 * Перечитывает пользователя (после перехода по ссылке из письма),
 * обновляет токен (чтобы в нём появился email_verified) и повышает роль
 * reader → user. Возвращает актуальный emailVerified.
 */
export async function refreshVerificationStatus() {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (user.emailVerified) {
    await user.getIdToken(true);
    await promoteToAuthor(user.uid);
  }
  return user.emailVerified;
}

/** Повышение роли без reload — когда токен уже содержит email_verified. */
export function syncRole() {
  const user = auth.currentUser;
  return user ? promoteToAuthor(user.uid) : Promise.resolve();
}
