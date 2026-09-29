// Сборка опубликованного снимка курса из рабочей версии.
// Сервер не доверяет содержимому черновика: всё проходит через те же
// функции очистки, что и на клиенте (shared/content.js, shared/tasks.js).
import { sanitizeBlocks, sanitizeCategories, sanitizeWord } from '../../shared/content.js';
import { LIMITS, PART_OF_SPEECH_IDS, buildSearchKeywords, normalizeText } from '../../shared/schema.js';

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
      title,
      language,
      description: String(course.description ?? '').slice(0, LIMITS.COURSE_DESCRIPTION_MAX),
      categories,
      lessonOrder: cleanOrder(course.lessonOrder, cleanLessons.map((l) => l.id)),
      referenceOrder: cleanOrder(course.referenceOrder, cleanReference.map((r) => r.id)),
      titleLower: normalizeText(title),
      languageLower: normalizeText(language),
      searchKeywords: buildSearchKeywords(title, language),
      lessonsCount: cleanLessons.length,
      wordsCount: cleanDictionary.length,
    },
    lessons: cleanLessons,
    reference: cleanReference,
    dictionary: cleanDictionary,
  };
}
