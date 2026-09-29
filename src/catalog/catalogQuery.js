/**
 * Чистая логика поиска по каталогу. Firestore умеет только один
 * array-contains на запрос, поэтому:
 *  - сервер фильтрует по самому длинному (самому избирательному) слову запроса
 *    через publicCourses.searchKeywords (префиксы слов названия и языка);
 *  - остальные слова проверяются на клиенте по тому же полю документа.
 */
import { normalizeText } from '../../shared/schema.js';

/** Длина префикса, до которой buildSearchKeywords хранит ключи. */
const KEYWORD_MAX = 20;
const WORDS_MAX = 5;

export const CATALOG_PAGE_SIZE = 12;

export const CATALOG_SORTS = Object.freeze({
  rating: { label: 'По рейтингу', field: 'score', direction: 'desc' },
  likes: { label: 'Больше лайков', field: 'likesCount', direction: 'desc' },
  dislikes: { label: 'Меньше дизлайков', field: 'dislikesCount', direction: 'asc' },
  newest: { label: 'Новые', field: 'publishedAt', direction: 'desc' },
});
export const DEFAULT_SORT = 'rating';

export function parseSearch(query) {
  const words = normalizeText(query).match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.map((w) => w.slice(0, KEYWORD_MAX)))].slice(0, WORDS_MAX);
}

/** Слово для серверного фильтра (самое длинное) или null. */
export function pickKeyword(words) {
  return words.reduce((best, w) => (!best || w.length > best.length ? w : best), null);
}

/** Все слова запроса — префиксы слов названия или языка курса. */
export function matchesSearch(course, words) {
  const keywords = new Set(course.searchKeywords ?? []);
  return words.every((w) => keywords.has(w));
}
