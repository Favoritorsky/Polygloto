import { describe, expect, it } from 'vitest';
import { buildPublicSnapshot, cleanCoAuthors } from './publicSnapshot.js';

describe('соавторы в снимке (v2)', () => {
  it('только строки, без повторов и автора, не больше 5', () => {
    expect(cleanCoAuthors(['b', 'b', 'a', 7, '', 'c', 'd', 'e', 'f', 'g'], 'a')).toEqual(['b', 'c', 'd', 'e', 'f']);
    expect(cleanCoAuthors(undefined, 'a')).toEqual([]);
  });
  it('попадают в метаданные снимка', () => {
    const { meta } = buildPublicSnapshot({
      course: { authorId: 'a', title: 'Курс', language: 'Испанский', coAuthors: ['b'] },
      author: { displayName: 'Автор' },
      lessons: [],
      reference: [],
      dictionary: [],
    });
    expect(meta.coAuthors).toEqual(['b']);
  });
});
