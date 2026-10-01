import { describe, expect, it } from 'vitest';
import { makeMemoryCards, makeSpeedQuestion, playableWords } from './gameLogic.js';

const words = [
  { id: 'a', word: 'hola', translation: 'привет' },
  { id: 'b', word: 'adiós', translation: 'пока' },
  { id: 'c', word: 'casa', translation: 'дом' },
  { id: 'd', word: 'perro', translation: 'собака' },
  { id: 'e', word: 'Hola', translation: 'здравствуй' },
  { id: 'f', word: 'chao', translation: 'Пока' },
  { id: 'g', word: '', translation: 'пусто' },
];

let seed = 1;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

describe('мини-игры', () => {
  it('для игр годятся слова без повторов слова и перевода', () => {
    expect(playableWords(words).map((w) => w.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('«Найди пары»: по две карточки на слово, не больше заданного числа пар', () => {
    const cards = makeMemoryCards(words, 3, random);
    expect(cards).toHaveLength(6);
    const byPair = new Map();
    for (const c of cards) byPair.set(c.pairId, [...(byPair.get(c.pairId) ?? []), c.side]);
    expect([...byPair.values()].every((sides) => sides.sort().join() === 'translation,word')).toBe(true);
    expect(new Set(cards.map((c) => c.key)).size).toBe(6);
  });

  it('«На скорость»: один верный вариант среди 4, слово не повторяется подряд', () => {
    let prev = null;
    for (let i = 0; i < 30; i += 1) {
      const q = makeSpeedQuestion(words, prev, random);
      expect(q.options).toHaveLength(4);
      expect(q.options.filter((o) => o.id === q.id)).toHaveLength(1);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
      expect(q.id).not.toBe(prev);
      prev = q.id;
    }
  });

  it('мало слов: вариантов меньше, при одном слове игры нет', () => {
    expect(makeSpeedQuestion(words.slice(0, 2), null, random).options).toHaveLength(2);
    expect(makeSpeedQuestion(words.slice(0, 1), null, random)).toBeNull();
  });
});
