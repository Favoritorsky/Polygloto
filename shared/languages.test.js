import { describe, expect, it } from 'vitest';
import {
  catalogLanguageFilter,
  CONLANGS_FILTER,
  CUSTOM_LANGUAGE_CHOICE,
  languageChoiceForCourse,
  languageFieldsFromChoice,
  languageFieldsForName,
  languageFieldsNeedFix,
} from './languages.js';
import { normalizeText } from './schema.js';

const curated = [
  { id: 'es', name: 'Испанский' },
  { id: 'fr', name: 'Французский' },
];

describe('язык курса', () => {
  it('название из списка (с учётом регистра) — official, иначе custom', () => {
    expect(languageFieldsForName('Испанский', curated)).toEqual({ language: 'Испанский', languageCategory: 'official', languageId: 'es' });
    expect(languageFieldsForName('испанский', curated)).toEqual({ language: 'испанский', languageCategory: 'custom', languageId: null });
    expect(languageFieldsForName(' Токипона ', curated)).toEqual({ language: 'Токипона', languageCategory: 'custom', languageId: null });
  });

  it('выбор в форме превращается в поля курса', () => {
    expect(languageFieldsFromChoice({ languageId: 'fr', customName: '' }, curated).language).toBe('Французский');
    expect(languageFieldsFromChoice({ languageId: CUSTOM_LANGUAGE_CHOICE, customName: 'Эсперанто' }, curated).languageCategory).toBe('custom');
    // «Другой язык» с названием из списка всё равно официальный.
    expect(languageFieldsFromChoice({ languageId: CUSTOM_LANGUAGE_CHOICE, customName: 'Испанский' }, curated).languageId).toBe('es');
    expect(languageFieldsFromChoice({ languageId: '', customName: '' }, curated)).toBeNull();
    expect(languageFieldsFromChoice({ languageId: 'gone', customName: '' }, curated)).toBeNull();
  });

  it('выбор для сохранённого курса', () => {
    expect(languageChoiceForCourse({ language: 'Испанский', languageCategory: 'official', languageId: 'es' }, curated).languageId).toBe('es');
    expect(languageChoiceForCourse({ language: 'Токипона', languageCategory: 'custom', languageId: null }, curated)).toEqual({
      languageId: CUSTOM_LANGUAGE_CHOICE,
      customName: 'Токипона',
    });
    // Курс до миграции.
    expect(languageChoiceForCourse({ language: 'Французский' }, curated).languageId).toBe('fr');
    // Язык убрали из списка.
    expect(languageChoiceForCourse({ language: 'Немецкий', languageCategory: 'official', languageId: 'de' }, curated).languageId).toBe(
      CUSTOM_LANGUAGE_CHOICE,
    );
  });

  it('поля чинятся после переименования или удаления языка', () => {
    expect(languageFieldsNeedFix({ language: 'Испанский', languageCategory: 'official', languageId: 'es' }, curated)).toBeNull();
    expect(languageFieldsNeedFix({ language: 'Испанский язык', languageCategory: 'official', languageId: 'es' }, curated)).toEqual({
      language: 'Испанский',
      languageCategory: 'official',
      languageId: 'es',
    });
    expect(languageFieldsNeedFix({ language: 'Немецкий', languageCategory: 'official', languageId: 'de' }, curated)).toEqual({
      language: 'Немецкий',
      languageCategory: 'custom',
      languageId: null,
    });
  });

  it('фильтр каталога', () => {
    expect(catalogLanguageFilter('', curated, normalizeText)).toBeNull();
    expect(catalogLanguageFilter(CONLANGS_FILTER, curated, normalizeText)).toEqual({ field: 'languageCategory', value: 'custom' });
    expect(catalogLanguageFilter('es', curated, normalizeText)).toEqual({ field: 'languageId', value: 'es' });
    expect(catalogLanguageFilter('Испанский', curated, normalizeText)).toEqual({ field: 'languageLower', value: 'испанский' });
  });
});
