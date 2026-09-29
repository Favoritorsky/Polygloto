import { describe, expect, it } from 'vitest';
import { buildSearchKeywords } from '../../shared/schema.js';
import { matchesSearch, parseSearch, pickKeyword } from './catalogQuery.js';

const course = { searchKeywords: buildSearchKeywords('Токипона за 10 уроков', 'Toki Pona') };

describe('parseSearch', () => {
  it('нормализует регистр, пунктуацию и повторы', () => {
    expect(parseSearch('  Токи,  ТОКИ pona! ')).toEqual(['токи', 'pona']);
  });
  it('пустой запрос — пустой список', () => {
    expect(parseSearch('  ,.! ')).toEqual([]);
  });
  it('длинные слова обрезаются до длины ключей, слов не больше пяти', () => {
    expect(parseSearch('a'.repeat(30))).toEqual(['a'.repeat(20)]);
    expect(parseSearch('a b c d e f g')).toHaveLength(5);
  });
});

describe('pickKeyword', () => {
  it('выбирает самое длинное слово', () => {
    expect(pickKeyword(['to', 'токипона', 'за'])).toBe('токипона');
    expect(pickKeyword([])).toBeNull();
  });
});

describe('matchesSearch', () => {
  it('совпадение по префиксам слов названия и языка', () => {
    expect(matchesSearch(course, parseSearch('ток pon'))).toBe(true);
    expect(matchesSearch(course, parseSearch('урок'))).toBe(true);
    expect(matchesSearch(course, parseSearch('10'))).toBe(true);
  });
  it('все слова должны совпасть; середина слова не ищется', () => {
    expect(matchesSearch(course, parseSearch('ток эсперанто'))).toBe(false);
    expect(matchesSearch(course, parseSearch('пона'))).toBe(false);
  });
  it('курс без ключей не совпадает с непустым запросом', () => {
    expect(matchesSearch({}, ['a'])).toBe(false);
    expect(matchesSearch({}, [])).toBe(true);
  });
});
