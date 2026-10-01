// Сборка опубликованного снимка курса из рабочей версии.
// Сервер не доверяет содержимому черновика: всё проходит через те же
// функции очистки, что и на клиенте (content.js, tasks.js).
// Используется при одобрении в браузере админа (approveCourse) и страницей
// проверки в админ-панели: модератор видит ровно то, что будет опубликовано.
import { sanitizeBlocks, sanitizeCategories, sanitizeWord } from './content.js';
import { LIMITS, PART_OF_SPEECH_IDS, buildSearchKeywords, normalizeText } from './schema.js';

function cleanOrder(order, ids) {
  const known = new Set(ids);
  const seen = new Set();
  const result = [];
  for (const id of Array.isArray(order) ? order : []) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  // Разделы, отсутствующие в порядке, не теряем — дописываем в конец.
  for (const id of ids) if (!seen.has(id)) result.push(id);
  return result;
}

/** Список соавторов: строки, без повторов и без автора, не больше LIMITS.COAUTHORS_MAX. */
export function cleanCoAuthors(list, authorId) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((uid) => typeof uid === 'string' && uid && uid.length <= 128 && uid !== authorId))].slice(
    0,
    LIMITS.COAUTHORS_MAX,
  );
}

/**
 * course — данные courses/{id}; lessons/reference/dictionary — массивы { id, data }.
 * Возвращает { meta, lessons, reference, dictionary } для записи в publicCourses.
 */
export function buildPublicSnapshot({ course, author, lessons, reference, dictionary }) {
  const categories = sanitizeCategories(course.categories);
  const categoryIds = new Set(categories.map((c) => c.id));
  const cleanSection = ({ id, data }) => ({
    id,
    data: {
      title: String(data.title ?? '').slice(0, LIMITS.LESSON_TITLE_MAX),
      blocks: sanitizeBlocks(data.blocks, { categoryIds }),
    },
  });
  const cleanLessons = lessons.map(cleanSection);
  const cleanReference = reference.map(cleanSection);
  const cleanDictionary = dictionary
    .map(({ id, data }) => {
      const word = sanitizeWord(data, PART_OF_SPEECH_IDS);
      return word ? { id, data: { ...word, wordLower: normalizeText(word.word) } } : null;
    })
    .filter(Boolean);

  const title = String(course.title ?? '').trim().slice(0, LIMITS.COURSE_TITLE_MAX);
  const language = String(course.language ?? '').trim().slice(0, LIMITS.COURSE_LANGUAGE_MAX);

  return {
    meta: {
      authorId: course.authorId,
      authorName: author?.displayName ?? 'Автор',
      // Соавторы (v2) — для подписи на странице курса.
      coAuthors: cleanCoAuthors(course.coAuthors, course.authorId),
      title,
      language,
      description: String(course.description ?? '').slice(0, LIMITS.COURSE_DESCRIPTION_MAX),
      categories,
      lessonOrder: cleanOrder(course.lessonOrder, cleanLessons.map((l) => l.id)),
      referenceOrder: cleanOrder(course.referenceOrder, cleanReference.map((r) => r.id)),
      titleLower: normalizeText(title),
      languageLower: normalizeText(language),
      searchKeywords: buildSearchKeywords(title, language),
      // Оглавление: читателю не нужно грузить все уроки, чтобы показать навигацию.
      toc: {
        lessons: cleanLessons.map((l) => ({ id: l.id, title: l.data.title })),
        reference: cleanReference.map((r) => ({ id: r.id, title: r.data.title })),
      },
      lessonsCount: cleanLessons.length,
      wordsCount: cleanDictionary.length,
    },
    lessons: cleanLessons,
    reference: cleanReference,
    dictionary: cleanDictionary,
  };
}
