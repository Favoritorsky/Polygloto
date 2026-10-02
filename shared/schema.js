/**
 * Единый источник правды о структуре данных Polygloto.
 *
 * Этот файл импортирует фронтенд (src/) и тесты. Firestore Security Rules
 * не умеют импортировать JS, поэтому те же лимиты продублированы в
 * firestore.rules — при изменении констант ниже обязательно обновите правила
 * (тесты в tests/rules проверяют граничные значения).
 *
 * Подробное описание коллекций: docs/data-model.md
 */

/** Коллекции Firestore. Никаких строковых литералов с путями в остальном коде. */
export const COLLECTIONS = Object.freeze({
  USERS: 'users',
  COURSES: 'courses',
  PUBLIC_COURSES: 'publicCourses',
  RATE_LIMITS: 'rateLimits',
  CATALOG_META: 'catalogMeta',
  COMMENT_AUTHORS: 'commentAuthors',
  USER_STATS: 'userStats',
  LEADERBOARDS: 'leaderboards',
  FOLLOWS: 'follows',
  CURATED_LANGUAGES: 'curatedLanguages',
});

/** catalogMeta/languages — список языков опубликованных курсов (обновляет админ при одобрении). */
export const CATALOG_LANGUAGES_DOC = 'languages';

/** Подколлекции курса (и его опубликованной копии). */
export const SUBCOLLECTIONS = Object.freeze({
  LESSONS: 'lessons',
  REFERENCE: 'reference',
  DICTIONARY: 'dictionary',
  AUDIO: 'audio',
  TASK_STATS: 'taskStats',
  COMMENTS: 'comments',
  LESSON_COMMENTS: 'lessonComments',
  REACTIONS: 'reactions',
  RATINGS: 'ratings',
});

/** Личные подколлекции users/{uid} (видит только владелец). */
export const USER_SUBCOLLECTIONS = Object.freeze({
  SRS_CARDS: 'srsCards',
  TASK_RESULTS: 'taskResults',
  COMPLETED_COURSES: 'completedCourses',
  LESSON_PROGRESS: 'lessonProgress',
});

/** Подколлекции с контентом, которые копируются в publicCourses при одобрении. */
export const CONTENT_SUBCOLLECTIONS = Object.freeze([
  SUBCOLLECTIONS.LESSONS,
  SUBCOLLECTIONS.REFERENCE,
  SUBCOLLECTIONS.DICTIONARY,
]);

export const ROLES = Object.freeze({
  READER: 'reader',
  USER: 'user',
  ADMIN: 'admin',
});

export const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
});

/**
 * Разрешённые клиенту (автору) переходы статуса рабочей версии курса.
 * published/rejected выставляет только админ (правило isModeration).
 * Дублируется в firestore.rules (функция isAuthorStatusChange).
 */
export const AUTHOR_STATUS_TRANSITIONS = Object.freeze({
  [COURSE_STATUS.DRAFT]: [COURSE_STATUS.PENDING_REVIEW],
  [COURSE_STATUS.PENDING_REVIEW]: [COURSE_STATUS.DRAFT],
  [COURSE_STATUS.PUBLISHED]: [COURSE_STATUS.DRAFT],
  [COURSE_STATUS.REJECTED]: [COURSE_STATUS.DRAFT],
});

export const RATING_VALUES = Object.freeze(['like', 'dislike']);

/** Фиксированный набор эмодзи-реакций (на уроки и комментарии). */
export const REACTION_EMOJIS = Object.freeze(['👍', '❤️', '🤔', '👏', '😂', '🔥']);
export const REACTION_TARGETS = Object.freeze(['lesson', 'comment']);

export const PARTS_OF_SPEECH = Object.freeze([
  { id: 'noun', label: 'Существительное' },
  { id: 'verb', label: 'Глагол' },
  { id: 'adjective', label: 'Прилагательное' },
  { id: 'adverb', label: 'Наречие' },
  { id: 'pronoun', label: 'Местоимение' },
  { id: 'numeral', label: 'Числительное' },
  { id: 'preposition', label: 'Предлог / послелог' },
  { id: 'conjunction', label: 'Союз' },
  { id: 'particle', label: 'Частица' },
  { id: 'interjection', label: 'Междометие' },
  { id: 'phrase', label: 'Выражение' },
  { id: 'other', label: 'Другое' },
]);
export const PART_OF_SPEECH_IDS = Object.freeze(PARTS_OF_SPEECH.map((p) => p.id));

/**
 * Лимиты размеров полей. Дублируются в firestore.rules.
 * Длины — в символах (Firestore Rules считают size() строки в символах).
 */
export const LIMITS = Object.freeze({
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 40,
  BIO_MAX: 500,
  PHOTO_URL_MAX: 1024,

  COURSE_TITLE_MIN: 3,
  COURSE_TITLE_MAX: 120,
  COURSE_LANGUAGE_MIN: 2,
  COURSE_LANGUAGE_MAX: 60,
  COURSE_DESCRIPTION_MAX: 2000,
  COURSE_CATEGORIES_MAX: 20,
  /** Соавторы курса (v2). */
  COAUTHORS_MAX: 5,
  CATEGORY_NAME_MAX: 40,
  CATEGORY_ABBR_MAX: 12,

  LESSON_TITLE_MAX: 120,
  LESSON_BLOCKS_MAX: 400,
  LESSONS_PER_COURSE_MAX: 200,

  WORD_MAX: 100,
  TRANSLATION_MAX: 300,
  WORD_NOTES_MAX: 1000,
  WORD_PRONUNCIATION_MAX: 200,
  WORD_EXAMPLES_MAX: 10,
  WORD_EXAMPLE_MAX: 300,

  COMMENT_MIN: 1,
  COMMENT_MAX: 2000,

  REJECTION_REASON_MIN: 5,
  REJECTION_REASON_MAX: 2000,

  // Аватар хранится в профиле как data URL (Storage на тарифе Spark недоступен).
  AVATAR_DATA_URL_MAX: 40000,
  AVATAR_SIZE_PX: 160,
  AVATAR_SOURCE_MAX_BYTES: 15 * 1024 * 1024,
});

/** Rate limiting (секунды между действиями одного пользователя). */
export const RATE_LIMITS = Object.freeze({
  CREATE_COURSE_SECONDS: 30,
  ADD_COMMENT_SECONDS: 15,
  UPLOAD_AUDIO_SECONDS: 5,
});

/** Задержка автосохранения черновика (мс). */
export const AUTOSAVE_DEBOUNCE_MS = 3000;

/**
 * Возвращает поисковые ключи для курса: все префиксы слов названия и языка
 * в нижнем регистре. Хранится в publicCourses.searchKeywords и используется
 * запросом array-contains (Firestore не умеет полнотекстовый поиск).
 */
export function buildSearchKeywords(title, language) {
  const keywords = new Set();
  const source = `${title ?? ''} ${language ?? ''}`.toLowerCase();
  const words = source.match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const word of words.slice(0, 30)) {
    for (let i = 1; i <= Math.min(word.length, 20); i += 1) {
      keywords.add(word.slice(0, i));
    }
  }
  return [...keywords].slice(0, 400);
}

/** Нормализация для сравнения/поиска: нижний регистр, схлопнутые пробелы. */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Палитра цветов текста в редакторе (и допустимые цвета категорий). */
export const PALETTE = Object.freeze([
  '#1d3557', '#e63946', '#f4a261', '#2a9d8f', '#457b9d',
  '#6a4c93', '#ff006e', '#8ac926', '#6c757d', '#b5838d',
]);
