/** Курируемый список языков (curatedLanguages). Читают все, пишет только админ (см. правила). */
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { LANGUAGE_CATEGORY, sortLanguages } from '../../shared/languages.js';
import { buildSearchKeywords, CATALOG_LANGUAGES_DOC, COLLECTIONS, LIMITS, normalizeText } from '../../shared/schema.js';
import { db } from './firebase.js';

/** [{ id, name }] по алфавиту. */
export async function listCuratedLanguages() {
  const snap = await getDocs(collection(db, COLLECTIONS.CURATED_LANGUAGES));
  return sortLanguages(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
}

/** Ошибка в названии или '' (дублирует проверку правил и не допускает повторов без учёта регистра). */
export function validateLanguageName(name, list, exceptId = null) {
  const value = String(name ?? '').trim();
  if (value.length < LIMITS.COURSE_LANGUAGE_MIN || value.length > LIMITS.COURSE_LANGUAGE_MAX) {
    return `Название: от ${LIMITS.COURSE_LANGUAGE_MIN} до ${LIMITS.COURSE_LANGUAGE_MAX} символов.`;
  }
  if (list.some((l) => l.id !== exceptId && normalizeText(l.name) === normalizeText(value))) return 'Такой язык уже есть в списке.';
  return '';
}

export async function addCuratedLanguage(name) {
  const ref = await addDoc(collection(db, COLLECTIONS.CURATED_LANGUAGES), { name: name.trim() });
  return ref.id;
}

/**
 * Переименование. Опубликованные курсы с этим языком получают новое название
 * сразу (снимки пишет админ); черновики — при следующей правке автором.
 */
export async function renameCuratedLanguage(id, oldName, name) {
  const value = name.trim();
  await updateDoc(doc(db, COLLECTIONS.CURATED_LANGUAGES, id), { name: value });
  const published = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('languageId', '==', id)));
  await commitInChunks(published.docs, (batch, d) =>
    batch.update(d.ref, { language: value, languageLower: normalizeText(value), searchKeywords: buildSearchKeywords(d.data().title, value) }),
  );
  // Счётчик языка в каталоге (catalogMeta/languages) переезжает под новое название.
  const metaRef = doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC);
  const meta = await getDoc(metaRef);
  if (!meta.exists()) return;
  const oldKey = normalizeText(oldName);
  const newKey = normalizeText(value);
  const items = meta.data().items ?? [];
  const moved = items.find((i) => i.key === oldKey);
  if (!moved || oldKey === newKey) {
    if (moved) await setDoc(metaRef, { items: items.map((i) => (i.key === oldKey ? { ...i, name: value } : i)) });
    return;
  }
  const target = items.find((i) => i.key === newKey);
  const rest = items.filter((i) => i.key !== oldKey && i.key !== newKey);
  await setDoc(metaRef, { items: [...rest, { key: newKey, name: value, count: moved.count + (target?.count ?? 0) }] });
}

/**
 * Удаление. Опубликованные курсы с этим языком становятся «Другой язык»
 * (custom) с прежним названием и видны в фильтре «Конланги»; черновики —
 * при следующей правке автором.
 */
export async function deleteCuratedLanguage(id) {
  const published = await getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('languageId', '==', id)));
  await commitInChunks(published.docs, (batch, d) => batch.update(d.ref, { languageCategory: LANGUAGE_CATEGORY.CUSTOM, languageId: null }));
  await deleteDoc(doc(db, COLLECTIONS.CURATED_LANGUAGES, id));
}

async function commitInChunks(docs, apply) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => apply(batch, d));
    await batch.commit();
  }
}
