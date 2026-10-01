/**
 * Экспорт и импорт курса в JSON (v2). Файл — рабочая версия курса: метаданные,
 * категории, уроки, справочник, словарь и используемые аудиофайлы. Импорт
 * создаёт новый черновик; всё содержимое проходит те же функции очистки, что
 * и редактор, поэтому файл из чужих рук не может внести ничего лишнего.
 */
import { collectAudioIds, isValidAudioDataUrl } from './audio.js';
import { sanitizeCategories } from './categories.js';
import { sanitizeBlocks, sanitizeWord } from './content.js';
import { LIMITS, PART_OF_SPEECH_IDS } from './schema.js';

export const COURSE_EXPORT_FORMAT = 'polygloto-course';
export const COURSE_EXPORT_VERSION = 1;
export const IMPORT_LIMITS = Object.freeze({
  FILE_MAX_BYTES: 15 * 1024 * 1024,
  REFERENCE_MAX: 200,
  WORDS_MAX: 3000,
  AUDIO_MAX: 100,
});

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');

function cleanSection(section, categoryIds) {
  return {
    title: str(section?.title, LIMITS.LESSON_TITLE_MAX),
    blocks: sanitizeBlocks(section?.blocks, { categoryIds }),
  };
}

/**
 * course — данные courses/{id}; lessons/reference — разделы по порядку
 * ({ title, blocks }); dictionary — [{ id, ...слово }]; audio — [{ id, dataUrl, name }].
 */
export function buildCourseExport({ course, lessons, reference, dictionary, audio = [] }, now = new Date()) {
  const categories = sanitizeCategories(course.categories);
  const categoryIds = new Set(categories.map((c) => c.id));
  const cleanLessons = lessons.map((s) => cleanSection(s, categoryIds));
  const cleanReference = reference.map((s) => cleanSection(s, categoryIds));
  const words = dictionary
    .map((w) => {
      const clean = sanitizeWord(w, PART_OF_SPEECH_IDS);
      return clean && ID_RE.test(w.id) ? { id: w.id, ...clean } : null;
    })
    .filter(Boolean);
  const used = collectAudioIds([cleanLessons, cleanReference, words]);
  return {
    format: COURSE_EXPORT_FORMAT,
    version: COURSE_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    course: {
      title: str(course.title, LIMITS.COURSE_TITLE_MAX),
      language: str(course.language, LIMITS.COURSE_LANGUAGE_MAX),
      description: str(course.description, LIMITS.COURSE_DESCRIPTION_MAX),
      categories,
    },
    lessons: cleanLessons,
    reference: cleanReference,
    dictionary: words,
    audio: audio
      .filter((a) => used.has(a.id) && isValidAudioDataUrl(a.dataUrl))
      .map(({ id, dataUrl, name }) => ({ id, dataUrl, name: str(name, 120) })),
  };
}

/**
 * Разбирает и очищает файл импорта. Возвращает { data } или { error } с
 * понятным текстом. data — тот же формат, что у buildCourseExport, плюс warnings.
 */
export function parseCourseImport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'Это не JSON-файл.' };
  }
  if (!raw || typeof raw !== 'object' || raw.format !== COURSE_EXPORT_FORMAT) {
    return { error: 'Это не файл курса Polygloto (нет поля format: "polygloto-course").' };
  }
  if (!Number.isInteger(raw.version) || raw.version < 1 || raw.version > COURSE_EXPORT_VERSION) {
    return { error: `Версия файла ${raw.version} не поддерживается: обновите страницу или экспортируйте курс заново.` };
  }
  const warnings = [];
  const course = raw.course ?? {};
  const title = str(course.title, LIMITS.COURSE_TITLE_MAX).trim();
  const language = str(course.language, LIMITS.COURSE_LANGUAGE_MAX).trim();
  if (title.length < LIMITS.COURSE_TITLE_MIN) return { error: `В файле нет названия курса (минимум ${LIMITS.COURSE_TITLE_MIN} символа).` };
  if (language.length < LIMITS.COURSE_LANGUAGE_MIN) return { error: 'В файле не указан язык курса.' };
  const categories = sanitizeCategories(course.categories);
  const categoryIds = new Set(categories.map((c) => c.id));

  const take = (list, max, label) => {
    const items = Array.isArray(list) ? list : [];
    if (items.length > max) warnings.push(`${label}: взяты первые ${max} из ${items.length}.`);
    return items.slice(0, max);
  };
  const lessons = take(raw.lessons, LIMITS.LESSONS_PER_COURSE_MAX, 'Уроки').map((s) => cleanSection(s, categoryIds));
  const reference = take(raw.reference, IMPORT_LIMITS.REFERENCE_MAX, 'Справочник').map((s) => cleanSection(s, categoryIds));
  if (lessons.length === 0) lessons.push({ title: 'Урок 1', blocks: [] });

  const seen = new Set();
  let skippedWords = 0;
  const dictionary = take(raw.dictionary, IMPORT_LIMITS.WORDS_MAX, 'Словарь')
    .map((w) => {
      const clean = sanitizeWord(w, PART_OF_SPEECH_IDS);
      if (!clean || typeof w.id !== 'string' || !ID_RE.test(w.id) || seen.has(w.id)) {
        skippedWords += 1;
        return null;
      }
      seen.add(w.id);
      return { id: w.id, ...clean };
    })
    .filter(Boolean);
  if (skippedWords) warnings.push(`Пропущено слов с ошибками: ${skippedWords}.`);

  const used = collectAudioIds([lessons, reference, dictionary]);
  const audioSeen = new Set();
  const audio = take(raw.audio, IMPORT_LIMITS.AUDIO_MAX, 'Аудио').filter((a) => {
    const ok = a && ID_RE.test(a.id ?? '') && used.has(a.id) && !audioSeen.has(a.id) && isValidAudioDataUrl(a.dataUrl);
    if (ok) audioSeen.add(a.id);
    return ok;
  });
  const missing = [...used].filter((id) => !audioSeen.has(id)).length;
  if (missing) warnings.push(`Нет в файле аудиозаписей: ${missing}; эти места останутся без звука.`);

  return {
    data: {
      course: { title, language, description: str(course.description, LIMITS.COURSE_DESCRIPTION_MAX), categories },
      lessons,
      reference,
      dictionary,
      audio: audio.map(({ id, dataUrl, name }) => ({ id, dataUrl, name: str(name, 120) })),
      warnings,
    },
  };
}

const TRANSLIT = Object.freeze({
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
});

/**
 * Имя файла для скачивания: только латиница, цифры и дефисы (кириллица
 * транслитерируется) — браузеры не везде принимают другие символы в имени.
 */
export function exportFileName(title, date = new Date()) {
  const slug = String(title ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return `${slug || 'course'}-${date.toISOString().slice(0, 10)}.polygloto.json`;
}
