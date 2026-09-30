import { describe, expect, it } from 'vitest';
import { CATEGORY_PRESETS, categoryGroup, defaultCategories, missingPresets, sanitizeCategories } from './categories.js';
import { LIMITS, PALETTE } from './schema.js';

describe('пресеты категорий', () => {
  it('в новом курсе 9 грамматических и 3 фонетических категории с сокращениями, в пределах лимита', () => {
    const cats = defaultCategories();
    expect(cats.filter((c) => c.group === 'grammar')).toHaveLength(9);
    expect(cats.filter((c) => c.group === 'phonetics').map((c) => c.name)).toEqual(['Гласный звук', 'Согласный звук', 'Ударный слог']);
    expect(cats.length).toBeLessThanOrEqual(LIMITS.COURSE_CATEGORIES_MAX);
    expect(new Set(cats.map((c) => c.id)).size).toBe(cats.length);
    for (const c of cats) {
      expect(PALETTE).toContain(c.color);
      expect(c.abbr.length).toBeLessThanOrEqual(LIMITS.CATEGORY_ABBR_MAX);
    }
  });

  it('defaultCategories возвращает копии: правка курса не портит пресеты', () => {
    defaultCategories()[0].name = 'Изменено';
    expect(CATEGORY_PRESETS[0].name).toBe('Существительное');
  });

  it('missingPresets показывает убранные автором пресеты группы, переименованные считаются на месте', () => {
    const cats = defaultCategories().filter((c) => c.id !== 'g_conj' && c.id !== 'ph_stress');
    cats[0].name = 'Имя сущ.';
    expect(missingPresets(cats, 'grammar').map((c) => c.id)).toEqual(['g_conj']);
    expect(missingPresets(cats, 'phonetics').map((c) => c.id)).toEqual(['ph_stress']);
    expect(missingPresets([], 'custom')).toEqual([]);
    expect(missingPresets(undefined, 'phonetics')).toHaveLength(3);
  });

  it('старые категории без группы — «свои»', () => {
    expect(categoryGroup({ id: 'cat_x' })).toBe('custom');
    expect(categoryGroup({ group: 'hack' })).toBe('custom');
    expect(categoryGroup({ group: 'phonetics' })).toBe('phonetics');
  });
});

describe('sanitizeCategories: сокращения и группы', () => {
  it('хранит сокращение, обрезает его до лимита, пустое не сохраняет', () => {
    const [a, b, c] = sanitizeCategories([
      { id: 'a', name: 'Глагол', color: PALETTE[1], abbr: '  глаг. ', group: 'grammar' },
      { id: 'b', name: 'Корень', color: PALETTE[2], abbr: 'x'.repeat(50) },
      { id: 'c', name: 'Суффикс', color: PALETTE[3], abbr: '   ' },
    ]);
    expect(a).toEqual({ id: 'a', name: 'Глагол', color: PALETTE[1], abbr: 'глаг.', group: 'grammar' });
    expect(b.abbr).toHaveLength(LIMITS.CATEGORY_ABBR_MAX);
    expect(b.group).toBe('custom');
    expect(c).not.toHaveProperty('abbr');
  });

  it('сокращение не строка — отбрасывается', () => {
    const [a] = sanitizeCategories([{ id: 'a', name: 'Глагол', color: PALETTE[1], abbr: { html: '<b>' } }]);
    expect(a).not.toHaveProperty('abbr');
  });
});
