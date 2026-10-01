import { describe, expect, it } from 'vitest';
import { counts, loadFeedback, saveFeedback, toggle } from './previewFeedback.js';
import { FRENCH_BLOCKS, FRENCH_CATEGORIES, FRENCH_DICTIONARY } from './frenchPreview.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
}

describe('previewFeedback', () => {
  it('ставит, меняет и снимает оценку и реакцию', () => {
    let f = { rating: null, reaction: null };
    f = toggle(f, 'rating', 'like');
    expect(counts(f)).toMatchObject({ likes: 1, dislikes: 0 });
    f = toggle(f, 'rating', 'dislike');
    expect(counts(f)).toMatchObject({ likes: 0, dislikes: 1 });
    f = toggle(f, 'rating', 'dislike');
    expect(f.rating).toBeNull();
    f = toggle(f, 'reaction', '🔥');
    expect(counts(f).reactions).toEqual({ counts: { '🔥': 1 }, mine: '🔥' });
    f = toggle(f, 'reaction', '🔥');
    expect(counts(f).reactions).toEqual({ counts: {}, mine: null });
  });

  it('запоминает выбор в хранилище и не падает без него', () => {
    const storage = memoryStorage();
    saveFeedback({ rating: 'like', reaction: '❤️' }, storage);
    expect(loadFeedback(storage)).toEqual({ rating: 'like', reaction: '❤️' });
    storage.setItem('polygloto.previewFeedback', '{битый json');
    expect(loadFeedback(storage)).toEqual({ rating: null, reaction: null });
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadFeedback(broken)).toEqual({ rating: null, reaction: null });
    expect(() => saveFeedback({ rating: 'like', reaction: null }, broken)).not.toThrow();
  });
});

describe('урок-превью французской фонетики', () => {
  it('использует только объявленные категории и содержит задания', () => {
    const ids = new Set(FRENCH_CATEGORIES.map((c) => c.id));
    const used = FRENCH_BLOCKS.flatMap((b) => b.children ?? [])
      .map((c) => c.category)
      .filter(Boolean);
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(ids.has(id)).toBe(true);
    expect(FRENCH_BLOCKS.filter((b) => b.type === 'task').length).toBeGreaterThanOrEqual(3);
  });

  it('у слов словаря уникальные id и есть транскрипция', () => {
    expect(new Set(FRENCH_DICTIONARY.map((e) => e.id)).size).toBe(FRENCH_DICTIONARY.length);
    for (const e of FRENCH_DICTIONARY) expect(e.notes).toMatch(/\[.+\]/);
  });
});
