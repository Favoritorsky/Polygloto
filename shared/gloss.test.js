import { describe, expect, it } from 'vitest';
import { alignGloss, glossMismatch, glossParts } from './gloss.js';

describe('подстрочный разбор', () => {
  it('выравнивает по словам', () => {
    expect(alignGloss('los  gatos duermen', 'DEF.PL кот-PL спать.PRS-3PL')).toEqual([
      { word: 'los', gloss: 'DEF.PL' },
      { word: 'gatos', gloss: 'кот-PL' },
      { word: 'duermen', gloss: 'спать.PRS-3PL' },
    ]);
  });

  it('лишние слова любой строки не теряются', () => {
    expect(alignGloss('a b c', 'x')).toEqual([
      { word: 'a', gloss: 'x' },
      { word: 'b', gloss: '' },
      { word: 'c', gloss: '' },
    ]);
    expect(glossMismatch('a b c', 'x')).toEqual({ source: 3, gloss: 1 });
    expect(glossMismatch('a b', 'x y')).toBeNull();
    expect(glossMismatch('', 'x y')).toBeNull();
  });

  it('пометы отделяются от морфем', () => {
    expect(glossParts('спать.PRS-3PL')).toEqual([
      { text: 'спать', label: false },
      { text: '.', label: false },
      { text: 'PRS', label: true },
      { text: '-', label: false },
      { text: '3PL', label: true },
    ]);
    expect(glossParts('кот-PL').map((p) => p.label)).toEqual([false, false, true]);
    expect(glossParts('1').map((p) => p.label)).toEqual([true]);
    expect(glossParts('I').map((p) => p.label)).toEqual([false]);
    expect(glossParts('cat').map((p) => p.label)).toEqual([false]);
  });
});
