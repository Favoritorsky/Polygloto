import { describe, expect, it } from 'vitest';
import { sanitizeBlocks } from './content.js';
import { LESSON_TEMPLATES, buildLessonFromTemplate } from './lessonTemplates.js';

describe('шаблоны уроков', () => {
  it('три шаблона из задания', () => {
    expect(LESSON_TEMPLATES.map((t) => t.label)).toEqual(['Новая лексика', 'Грамматическая тема', 'Диалог']);
  });

  it('блоки шаблонов проходят очистку без потерь, у заданий уникальные id', () => {
    for (const t of LESSON_TEMPLATES) {
      const { title, blocks } = buildLessonFromTemplate(t.id);
      expect(title.length).toBeGreaterThan(0);
      expect(sanitizeBlocks(blocks)).toEqual(blocks);
      expect(blocks.length).toBe(t.blocks().length);
      const ids = blocks.filter((b) => b.type === 'task').map((b) => b.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('каждый вызов даёт новые id заданий (два урока из одного шаблона не конфликтуют)', () => {
    const a = buildLessonFromTemplate('grammar')
      .blocks.filter((b) => b.type === 'task')
      .map((b) => b.id);
    const b = buildLessonFromTemplate('grammar')
      .blocks.filter((x) => x.type === 'task')
      .map((x) => x.id);
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('у грамматики таблица с заголовками строк и столбцов', () => {
    const t = buildLessonFromTemplate('grammar').blocks.find((b) => b.type === 'table');
    expect(t.headerRow && t.headerColumn).toBe(true);
  });

  it('неизвестный шаблон — null', () => {
    expect(buildLessonFromTemplate('nope')).toBeNull();
  });
});
