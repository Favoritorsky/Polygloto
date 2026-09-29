import { describe, expect, it } from 'vitest';
import { buildSearchKeywords } from '../../shared/schema.js';
import { matchesSearch, parseSearch, pickKeyword, sortCourses } from './catalogQuery.js';

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

describe('sortCourses', () => {
  const ts = (ms) => ({ toMillis: () => ms });
  const courses = [
    { id: 'a', score: 1, likesCount: 5, dislikesCount: 2, publishedAt: ts(100) },
    { id: 'b', score: 3, likesCount: 3, dislikesCount: 0, publishedAt: ts(200) },
    { id: 'c', score: 1, likesCount: 1, dislikesCount: 0, publishedAt: ts(300) },
  ];
  const ids = (list) => list.map((c) => c.id).join('');

  it('сортирует по выбранному полю и направлению', () => {
    expect(ids(sortCourses(courses, 'rating'))).toBe('bca');
    expect(ids(sortCourses(courses, 'likes'))).toBe('abc');
    expect(ids(sortCourses(courses, 'dislikes'))).toBe('cba');
    expect(ids(sortCourses(courses, 'newest'))).toBe('cba');
  });

  it('не меняет исходный массив и понимает неизвестную сортировку', () => {
    const copy = [...courses];
    expect(ids(sortCourses(courses, 'nope'))).toBe('bca');
    expect(courses).toEqual(copy);
  });
});
