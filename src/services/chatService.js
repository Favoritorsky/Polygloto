/**
 * Чаты языков (languageChats/{chatId}/messages). Комната есть у каждого языка,
 * на котором опубликован хотя бы один курс: сообщение ссылается на такой курс,
 * и правила сверяют язык курса с id комнаты (shared/chat.js). Сообщение пишется
 * одной пакетной записью с отметкой rateLimits.chatMessage (не чаще раза в 3 с).
 */
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { chatIdForLanguage } from '../../shared/chat.js';
import { COLLECTIONS, LIMITS, RATE_LIMITS, SUBCOLLECTIONS, normalizeText } from '../../shared/schema.js';
import { UserFacingError } from './errors.js';
import { db } from './firebase.js';
import { stampRateLimit, withRateLimit } from './rateLimit.js';

/** Сколько последних сообщений показывает комната (и сколько добавляет «Показать раньше»). */
export const CHAT_PAGE = 100;

const messagesCol = (chatId) => collection(db, COLLECTIONS.LANGUAGE_CHATS, chatId, SUBCOLLECTIONS.MESSAGES);

/** Последние count сообщений комнаты — в порядке написания (старые сверху). */
export function subscribeToChat(languageLower, count, onData, onError) {
  const q = query(messagesCol(chatIdForLanguage(languageLower)), orderBy('createdAt', 'desc'), limit(count));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).reverse()),
    onError,
  );
}

/** Какой-нибудь опубликованный курс на этом языке — на него ссылается сообщение (проверка правил). */
export async function findCourseForLanguage(languageLower) {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('languageLower', '==', normalizeText(languageLower)), limit(1)),
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export function validateChatMessage(text) {
  const trimmed = text.trim();
  if (trimmed.length < LIMITS.CHAT_MESSAGE_MIN) return 'Напишите что-нибудь.';
  if (trimmed.length > LIMITS.CHAT_MESSAGE_MAX) return `Не больше ${LIMITS.CHAT_MESSAGE_MAX} символов.`;
  return null;
}

/** author: { uid, displayName } — имя должно совпадать с профилем (проверяют правила). */
export async function sendChatMessage(languageLower, courseId, author, text) {
  if (!courseId) throw new UserFacingError('Для этого языка нет опубликованных курсов — чат закрыт.');
  const ref = doc(messagesCol(chatIdForLanguage(languageLower)));
  const batch = writeBatch(db);
  batch.set(ref, {
    authorId: author.uid,
    authorName: author.displayName,
    text: text.trim(),
    courseId,
    createdAt: serverTimestamp(),
  });
  stampRateLimit(batch, author.uid, 'chatMessage');
  await withRateLimit(author.uid, 'chatMessage', RATE_LIMITS.CHAT_MESSAGE_SECONDS, () => batch.commit());
  return ref.id;
}

/** Удалить может автор сообщения и админ (правила). */
export function deleteChatMessage(languageLower, messageId) {
  return deleteDoc(doc(messagesCol(chatIdForLanguage(languageLower)), messageId));
}
