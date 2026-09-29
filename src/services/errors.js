/**
 * Перевод ошибок Firebase в понятные пользователю сообщения.
 * Все сервисы пробрасывают исходную ошибку; UI вызывает toUserMessage().
 */
const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Неверный email или пароль.',
  'auth/wrong-password': 'Неверный пароль.',
  'auth/user-not-found': 'Пользователь с таким email не найден.',
  'auth/email-already-in-use': 'Этот email уже зарегистрирован. Войдите или восстановите пароль.',
  'auth/invalid-email': 'Некорректный email.',
  'auth/weak-password': 'Слишком простой пароль: минимум 6 символов.',
  'auth/missing-password': 'Введите пароль.',
  'auth/too-many-requests': 'Слишком много попыток. Подождите немного и попробуйте снова.',
  'auth/network-request-failed': 'Нет соединения с сервером. Проверьте интернет.',
  'auth/user-disabled': 'Аккаунт отключён.',
  'auth/requires-recent-login': 'Для этого действия войдите заново.',
  'auth/expired-action-code': 'Ссылка устарела. Запросите новую.',
  'auth/invalid-action-code': 'Ссылка недействительна или уже использована.',
};

const FIRESTORE_MESSAGES = {
  'permission-denied': 'Недостаточно прав для этого действия.',
  unavailable: 'Сервер недоступен. Проверьте интернет и попробуйте снова.',
  'not-found': 'Данные не найдены.',
  'resource-exhausted': 'Слишком часто. Подождите немного и попробуйте снова.',
  unauthenticated: 'Войдите в аккаунт.',
  'deadline-exceeded': 'Сервер отвечает слишком долго. Попробуйте снова.',
};

export function toUserMessage(error) {
  if (!error) return '';
  const code = String(error.code || '').replace(/^(firestore|functions|storage)\//, '');
  if (AUTH_MESSAGES[error.code]) return AUTH_MESSAGES[error.code];
  // Ошибки из Cloud Functions (HttpsError) уже содержат русское сообщение.
  if (String(error.code || '').startsWith('functions/') && error.message && code !== 'internal') {
    return error.message;
  }
  if (FIRESTORE_MESSAGES[code]) return FIRESTORE_MESSAGES[code];
  if (error.userMessage) return error.userMessage;
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

/** Ошибка с готовым текстом для пользователя (для клиентской валидации). */
export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.userMessage = message;
  }
}
