/** Каталог опубликованных курсов: поиск, фильтр по языку, сортировка, постраничная загрузка. */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { CATALOG_LANGUAGES_DOC, COLLECTIONS, normalizeText } from '../../shared/schema.js';
import { CATALOG_PAGE_SIZE, CATALOG_SORTS, DEFAULT_SORT, matchesSearch, parseSearch, pickKeyword } from '../catalog/catalogQuery.js';
import { db } from './firebase.js';

/** Сколько раз подряд дочитывать страницы, если клиентская доводка поиска отсеяла почти всё. */
const MAX_ROUNDS = 5;

/**
 * Страница каталога. cursor — последний документ предыдущей страницы.
 * Возвращает { items, cursor, hasMore }. При поиске по нескольким словам
 * часть документов отсеивается на клиенте, поэтому страница дочитывается
 * (не больше MAX_ROUNDS запросов), пока не наберётся pageSize курсов.
 */
export async function fetchCatalogPage({ search = '', language = '', sort = DEFAULT_SORT, cursor = null, pageSize = CATALOG_PAGE_SIZE } = {}) {
  const words = parseSearch(search);
  const keyword = pickKeyword(words);
  const languageKey = normalizeText(language);
  const { field, direction } = CATALOG_SORTS[sort] ?? CATALOG_SORTS[DEFAULT_SORT];

  const base = [];
  if (keyword) base.push(where('searchKeywords', 'array-contains', keyword));
  if (languageKey) base.push(where('languageLower', '==', languageKey));
  base.push(orderBy(field, direction));

  const items = [];
  let hasMore = true;
  for (let round = 0; round < MAX_ROUNDS && hasMore && items.length < pageSize; round += 1) {
    const constraints = [...base, ...(cursor ? [startAfter(cursor)] : []), limit(pageSize)];
    const snap = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), ...constraints));
    for (const d of snap.docs) {
      const course = { id: d.id, ...d.data() };
      if (matchesSearch(course, words)) items.push(course);
    }
    cursor = snap.docs.at(-1) ?? cursor;
    hasMore = snap.docs.length === pageSize;
  }
  return { items, cursor, hasMore };
}

/** Языки опубликованных курсов: [{ key, name, count }]. */
export async function getCatalogLanguages() {
  const snap = await getDoc(doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC));
  return snap.exists() ? snap.data().items ?? [] : [];
}
