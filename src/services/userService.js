/**
 * Документы users/{uid}. Роль admin и бан клиент себе поставить не может —
 * это проверяют правила; здесь функции пишут только разрешённые поля.
 */
import { collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { COLLECTIONS, LIMITS, ROLES } from '../../shared/schema.js';
import { auth, db } from './firebase.js';

const userRef = (uid) => doc(db, COLLECTIONS.USERS, uid);

/** Имя по умолчанию. Email не используем — он не должен стать публичным. */
export function defaultDisplayName(uid) {
  return `Автор-${uid.slice(0, 6)}`;
}

// uid, для которых профиль прямо сейчас создаёт регистрация (AuthProvider не мешает).
const creating = new Set();

export function isProfileBeingCreated(uid) {
  return creating.has(uid);
}

/**
 * Создаёт профиль, если его ещё нет (идемпотентно: транзакция не перезапишет
 * существующий). Роль reader; user — если почта уже подтверждена.
 */
export async function createOwnProfile(uid, { displayName } = {}) {
  creating.add(uid);
  try {
    const name = (displayName ?? '').trim().slice(0, LIMITS.DISPLAY_NAME_MAX);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef(uid));
      if (snap.exists()) return;
      tx.set(userRef(uid), {
        displayName: name.length >= LIMITS.DISPLAY_NAME_MIN ? name : defaultDisplayName(uid),
        bio: '',
        photoURL: null,
        role: auth.currentUser?.emailVerified ? ROLES.USER : ROLES.READER,
        banned: false,
        createdAt: serverTimestamp(),
      });
    });
  } finally {
    creating.delete(uid);
  }
}

/** reader → user после подтверждения почты (правила проверяют email_verified в токене). */
// Повышение могут запросить одновременно AuthProvider и экран подтверждения
// email; одна транзакция на uid избавляет от конфликта версий документа.
const promotions = new Map();

export function promoteToAuthor(uid) {
  if (!promotions.has(uid)) {
    const promotion = runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef(uid));
      if (snap.exists() && snap.data().role === ROLES.READER) tx.update(userRef(uid), { role: ROLES.USER });
    }).finally(() => promotions.delete(uid));
    promotions.set(uid, promotion);
  }
  return promotions.get(uid);
}

export function subscribeToUser(uid, onData, onError) {
  return onSnapshot(
    userRef(uid),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
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

/**
 * Обновляет только разрешённые поля собственного профиля. При смене имени
 * той же пакетной записью обновляется authorName в опубликованных курсах
 * автора (правила допускают это только вместе с новым именем в профиле).
 */
export async function updateOwnProfile(uid, { displayName, bio, photoURL }) {
  const patch = {};
  if (displayName !== undefined) patch.displayName = displayName.trim();
  if (bio !== undefined) patch.bio = bio;
  if (photoURL !== undefined) patch.photoURL = photoURL;

  const batch = writeBatch(db);
  batch.update(userRef(uid), patch);
  if (patch.displayName !== undefined) {
    const published = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('authorId', '==', uid)));
    // Пакет ограничен 500 записями; у одного автора столько курсов не бывает.
    published.docs
      .filter((d) => d.data().authorName !== patch.displayName)
      .slice(0, 400)
      .forEach((d) => batch.update(d.ref, { authorName: patch.displayName }));
  }
  await batch.commit();
}
