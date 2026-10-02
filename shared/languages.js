/**
 * Язык курса: курируемый список (curatedLanguages, ведёт администратор) или
 * «Другой язык» — произвольное название для конлангов и языков, которых в
 * списке пока нет.
 *
 * У курса три поля: language (название, как и раньше), languageCategory
 * ('official' | 'custom') и languageId (id из curatedLanguages или null).
 * Правила Firestore проверяют, что 'official' ставится только вместе с
 * существующим languageId и тем же названием, что в списке.
 */

export const LANGUAGE_CATEGORY = Object.freeze({ OFFICIAL: 'official', CUSTOM: 'custom' });

/** Пункт «Другой язык» в выпадающем списке. */
export const CUSTOM_LANGUAGE_CHOICE = '__custom__';

/** Значение фильтра каталога «Конланги» (все курсы с languageCategory 'custom'). */
export const CONLANGS_FILTER = 'conlangs';

/** Список по алфавиту (русская сортировка). */
export function sortLanguages(list) {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

/** Поля курса для языка с таким названием: из списка, если название совпадает точно (с учётом регистра). */
export function languageFieldsForName(name, curated) {
  const language = String(name ?? '').trim();
  const match = curated.find((l) => l.name === language);
  return match
    ? { language: match.name, languageCategory: LANGUAGE_CATEGORY.OFFICIAL, languageId: match.id }
    : { language, languageCategory: LANGUAGE_CATEGORY.CUSTOM, languageId: null };
}

/**
 * Поля курса по выбору в форме: { languageId, customName }.
 * languageId — id из списка, CUSTOM_LANGUAGE_CHOICE или '' (ещё не выбран).
 */
export function languageFieldsFromChoice({ languageId, customName }, curated) {
  if (languageId && languageId !== CUSTOM_LANGUAGE_CHOICE) {
    const match = curated.find((l) => l.id === languageId);
    if (match) return { language: match.name, languageCategory: LANGUAGE_CATEGORY.OFFICIAL, languageId: match.id };
    return null;
  }
  if (languageId === CUSTOM_LANGUAGE_CHOICE) return languageFieldsForName(customName, curated);
  return null;
}

/** Выбор в форме для уже сохранённого курса. */
export function languageChoiceForCourse(course, curated) {
  if (course.languageCategory === LANGUAGE_CATEGORY.OFFICIAL && curated.some((l) => l.id === course.languageId)) {
    return { languageId: course.languageId, customName: '' };
  }
  // Курс до миграции (без languageCategory): ищем название в списке.
  if (!course.languageCategory) {
    const match = curated.find((l) => l.name === course.language);
    if (match) return { languageId: match.id, customName: '' };
  }
  return { languageId: CUSTOM_LANGUAGE_CHOICE, customName: course.language ?? '' };
}

/** Нужно ли перезаписать поля языка курса, чтобы они снова прошли правила (язык переименовали или удалили из списка). */
export function languageFieldsNeedFix(course, curated) {
  const fields = languageFieldsFromChoice(languageChoiceForCourse(course, curated), curated);
  return Boolean(fields) && (fields.language !== course.language
    || fields.languageCategory !== course.languageCategory
    || (fields.languageId ?? null) !== (course.languageId ?? null)) ? fields : null;
}

/**
 * Фильтр каталога по значению параметра lang: «Конланги», id языка из списка
 * или (старые ссылки) название языка. Возвращает { field, value } для запроса
 * к publicCourses или null — «Все языки».
 */
export function catalogLanguageFilter(lang, curated, normalize) {
  if (!lang) return null;
  if (lang === CONLANGS_FILTER) return { field: 'languageCategory', value: LANGUAGE_CATEGORY.CUSTOM };
  if (curated.some((l) => l.id === lang)) return { field: 'languageId', value: lang };
  return { field: 'languageLower', value: normalize(lang) };
}
