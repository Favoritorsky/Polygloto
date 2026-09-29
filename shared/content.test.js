import { describe, expect, it } from 'vitest';
import { sanitizeBlocks, sanitizeCategories, sanitizeLeaf } from './content.js';

describe('sanitizeLeaf', () => {
  it('оставляет только известные атрибуты', () => {
    expect(
      sanitizeLeaf({ text: 'Привет', bold: true, italic: 'yes', color: '#e63946', onclick: 'x', html: '<b>' }),
    ).toEqual({ text: 'Привет', bold: true, color: '#e63946' });
  });

  it('отбрасывает цвет не из палитры (в т.ч. CSS-инъекции)', () => {
    expect(sanitizeLeaf({ text: 'a', color: 'red; background:url(x)' })).toEqual({ text: 'a' });
  });

  it('категория — только из списка курса', () => {
    const categoryIds = new Set(['cat_1']);
    expect(sanitizeLeaf({ text: 'a', category: 'cat_1' }, { categoryIds })).toEqual({ text: 'a', category: 'cat_1' });
    expect(sanitizeLeaf({ text: 'a', category: 'cat_2' }, { categoryIds })).toEqual({ text: 'a' });
  });

  it('нестроковый текст превращается в пустую строку', () => {
    expect(sanitizeLeaf({ text: { $gt: 1 } })).toEqual({ text: '' });
  });
});

describe('sanitizeBlocks', () => {
  it('отбрасывает неизвестные блоки и зарезервированные v2', () => {
    const result = sanitizeBlocks([
      { type: 'paragraph', children: [{ text: 'a' }] },
      { type: 'script', children: [] },
      { type: 'audio', src: 'x' },
      null,
    ]);
    expect(result).toEqual([{ type: 'paragraph', children: [{ text: 'a' }] }]);
  });

  it('пустой абзац получает пустой лист', () => {
    expect(sanitizeBlocks([{ type: 'paragraph' }])).toEqual([{ type: 'paragraph', children: [{ text: '' }] }]);
  });

  it('таблица выравнивается по ширине и ограничивается', () => {
    const [table] = sanitizeBlocks([{ type: 'table', rows: [{ cells: ['a', 'b'] }, { cells: ['c'] }, 'мусор'] }]);
    expect(table.rows).toEqual([{ cells: ['a', 'b'] }, { cells: ['c', ''] }, { cells: ['', ''] }]);
    expect(table.headerRow).toBe(true);
  });

  it('заголовок — только уровни 2 и 3', () => {
    expect(sanitizeBlocks([{ type: 'heading', level: 1, children: [{ text: 'x' }] }])[0].level).toBe(2);
  });

  it('не массив → пустой массив', () => {
    expect(sanitizeBlocks('<script>')).toEqual([]);
  });
});

describe('sanitizeCategories', () => {
  it('убирает дубликаты, пустые имена и чужие цвета', () => {
    expect(
      sanitizeCategories([
        { id: 'cat_a', name: ' Гласные ', color: '#e63946' },
        { id: 'cat_a', name: 'Дубль', color: '#e63946' },
        { id: 'cat_b', name: '   ', color: '#e63946' },
        { id: 'cat_c', name: 'Корень', color: 'javascript:1' },
      ]),
    ).toEqual([
      { id: 'cat_a', name: 'Гласные', color: '#e63946' },
      { id: 'cat_c', name: 'Корень', color: '#1d3557' },
    ]);
  });
});
