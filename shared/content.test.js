import { describe, expect, it } from 'vitest';
import { sanitizeBlocks, sanitizeCategories, sanitizeLeaf, sanitizeWord, tableCellRole } from './content.js';

describe('sanitizeLeaf', () => {
  it('оставляет только известные атрибуты', () => {
    expect(sanitizeLeaf({ text: 'Привет', bold: true, italic: 'yes', color: '#e63946', onclick: 'x', html: '<b>' })).toEqual({
      text: 'Привет',
      bold: true,
      color: '#e63946',
    });
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
  it('отбрасывает неизвестные блоки', () => {
    const result = sanitizeBlocks([{ type: 'paragraph', children: [{ text: 'a' }] }, { type: 'script', children: [] }, null]);
    expect(result).toEqual([{ type: 'paragraph', children: [{ text: 'a' }] }]);
  });

  it('аудиоблок (v2): только допустимая ссылка и подпись', () => {
    const [ok, bad, empty] = sanitizeBlocks([
      { type: 'audio', audio: { kind: 'file', id: 'a1' }, caption: 'Диалог', src: 'x' },
      { type: 'audio', audio: { kind: 'url', url: 'https://evil.example/a.mp3' }, caption: 'x'.repeat(400) },
      { type: 'audio' },
    ]);
    expect(ok).toEqual({ type: 'audio', audio: { kind: 'file', id: 'a1' }, caption: 'Диалог' });
    expect(bad.audio).toBeNull();
    expect(bad.caption).toHaveLength(300);
    expect(empty).toEqual({ type: 'audio', audio: null, caption: '' });
  });

  it('произношение слова: только допустимая ссылка', () => {
    expect(sanitizeWord({ word: 'hola', translation: 'привет', audio: { kind: 'file', id: 'a1' } }, ['other']).audio).toEqual({
      kind: 'file',
      id: 'a1',
    });
    expect('audio' in sanitizeWord({ word: 'hola', translation: 'привет', audio: { kind: 'url', url: 'http://x' } }, ['other'])).toBe(
      false,
    );
  });

  it('пустой абзац получает пустой лист', () => {
    expect(sanitizeBlocks([{ type: 'paragraph' }])).toEqual([{ type: 'paragraph', children: [{ text: '' }] }]);
  });

  it('таблица выравнивается по ширине и ограничивается', () => {
    const [table] = sanitizeBlocks([{ type: 'table', rows: [{ cells: ['a', 'b'] }, { cells: ['c'] }, 'мусор'] }]);
    expect(table.rows).toEqual([{ cells: ['a', 'b'] }, { cells: ['c', ''] }, { cells: ['', ''] }]);
    expect(table.headerRow).toBe(true);
    expect(table.headerColumn).toBe(false);
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
      { id: 'cat_a', name: 'Гласные', color: '#e63946', group: 'custom' },
      { id: 'cat_c', name: 'Корень', color: '#1d3557', group: 'custom' },
    ]);
  });
});

describe('таблицы: заголовки по строке и по столбцу', () => {
  const rows = [{ cells: ['', 'ед.', 'мн.'] }, { cells: ['1 л.', 'yo', 'nosotros'] }];

  it('хранит оба флага как булевы значения, мусор не пропускает', () => {
    const [both] = sanitizeBlocks([{ type: 'table', headerRow: true, headerColumn: true, rows }]);
    expect(both).toMatchObject({ headerRow: true, headerColumn: true });
    const [none] = sanitizeBlocks([{ type: 'table', headerRow: false, headerColumn: false, rows }]);
    expect(none).toMatchObject({ headerRow: false, headerColumn: false });
    const [junk] = sanitizeBlocks([{ type: 'table', headerRow: 'нет', headerColumn: 'да', rows }]);
    expect(junk).toMatchObject({ headerRow: true, headerColumn: false });
  });

  it('роли ячеек во всех сочетаниях флагов', () => {
    const roles = (headerRow, headerColumn) => [0, 1].map((r) => [0, 1].map((c) => tableCellRole({ headerRow, headerColumn }, r, c)));
    expect(roles(true, true)).toEqual([
      ['corner', 'column'],
      ['row', 'cell'],
    ]);
    expect(roles(true, false)).toEqual([
      ['column', 'column'],
      ['cell', 'cell'],
    ]);
    expect(roles(false, true)).toEqual([
      ['row', 'cell'],
      ['row', 'cell'],
    ]);
    expect(roles(false, false)).toEqual([
      ['cell', 'cell'],
      ['cell', 'cell'],
    ]);
  });

  it('таблица 1×1 с обоими флагами — одна угловая ячейка; старые таблицы без флага — заголовок-строка', () => {
    expect(tableCellRole({ headerRow: true, headerColumn: true }, 0, 0)).toBe('corner');
    expect(tableCellRole({}, 0, 0)).toBe('column');
    expect(tableCellRole({}, 1, 0)).toBe('cell');
  });
});
