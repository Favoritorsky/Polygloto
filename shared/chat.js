/**
 * Чаты языков: у каждого языка, на котором есть опубликованный курс, — своя
 * комната languageChats/{chatId}/messages. Язык определяется так же, как
 * в фильтре каталога, — по languageLower (normalizeText названия), поэтому
 * курсы из курируемого списка и «Другой язык» с тем же названием попадают в один чат.
 * Тот же id строят правила (firestore.rules, match /languageChats) — меняйте синхронно.
 */
import { normalizeText } from './schema.js';

const PREFIX = 'lang-';

/** id чата по languageLower: «/» в id документа недопустим и заменяется на «_». */
export function chatIdForLanguage(languageLower) {
  return PREFIX + normalizeText(languageLower).replaceAll('/', '_');
}

/** Адрес страницы чата. course — id опубликованного курса на этом языке (необязательно). */
export function chatPath(languageLower, courseId = null) {
  const base = `/chats/${encodeURIComponent(normalizeText(languageLower))}`;
  return courseId ? `${base}?course=${encodeURIComponent(courseId)}` : base;
}
