/** Каталог опубликованных курсов: поиск, фильтр по языку, сортировка, постраничная загрузка. */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { CATALOG_LANGUAGES_DOC, COLLECTIONS } from '../../shared/schema.js';
import { CATALOG_PAGE_SIZE, CATALOG_SORTS, DEFAULT_SORT, matchesSearch, parseSearch, pickKeyword, sortCourses } from '../catalog/catalogQuery.js';
import { db } from './firebase.js';

/** Сколько курсов читать для поиска или фильтра по языку (сортируются на клиенте). */
export const FILTERED_MAX = 300;

/** Последняя выборка с фильтром: «Показать ещё» листает её без новых чтений. */
let filteredCache = { key: null, items: [] };

/**
 * Страница каталога. Возвращает { items, cursor, hasMore }.
 *
 * Без поиска и фильтра — серверная сортировка и постраничное чтение
 * (cursor — последний документ страницы). С поиском или фильтром по языку
 * запрос обходится без orderBy: составной индекс «фильтр + сортировка»
 * ключ деплоя создать не может, а одиночные индексы Firestore строит сам.
 * Тогда читаются до FILTERED_MAX подходящих курсов, сортируются на клиенте,
 * а cursor — смещение в этой выборке.
 */
export async function fetchCatalogPage({ search = '', languageFilter = null, sort = DEFAULT_SORT, cursor = null, pageSize = CATALOG_PAGE_SIZE } = {}) {
  const words = parseSearch(search);
  const keyword = pickKeyword(words);
  if (keyword || languageFilter) return fetchFilteredPage({ words, keyword, languageFilter, sort, offset: cursor ?? 0, pageSize });

  const { field, direction } = CATALOG_SORTS[sort] ?? CATALOG_SORTS[DEFAULT_SORT];
  const constraints = [orderBy(field, direction), ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)];
  const snap = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), ...constraints));
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: snap.docs.at(-1) ?? cursor,
    hasMore: snap.docs.length === pageSize,
  };
}

async function fetchFilteredPage({ words, keyword, languageFilter, sort, offset, pageSize }) {
  const key = JSON.stringify([words, languageFilter]);
  if (offset === 0 || filteredCache.key !== key) {
    const filters = [];
    if (keyword) filters.push(where('searchKeywords', 'array-contains', keyword));
    // languageFilter — см. catalogLanguageFilter в shared/languages.js (язык из списка, «Конланги» или старая ссылка).
    if (languageFilter) filters.push(where(languageFilter.field, '==', languageFilter.value));
    const snap = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), ...filters, limit(FILTERED_MAX)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((course) => matchesSearch(course, words));
    filteredCache = { key, items };
  }
  const sorted = sortCourses(filteredCache.items, sort);
  const items = sorted.slice(offset, offset + pageSize);
  return { items, cursor: offset + items.length, hasMore: offset + items.length < sorted.length };
}

/** Языки опубликованных курсов: [{ key, name, count }]. */
export async function getCatalogLanguages() {
  const snap = await getDoc(doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC));
  return snap.exists() ? snap.data().items ?? [] : [];
}
