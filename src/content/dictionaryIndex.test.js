import { describe, expect, it } from 'vitest';
import { buildDictionaryIndex, collectLessonWords, filterDictionary, segmentText } from './dictionaryIndex.js';

const entries = [
  { id: '1', word: 'toki', translation: 'язык, речь', partOfSpeech: 'noun' },
  { id: '2', word: 'pona', translation: 'хороший', partOfSpeech: 'adjective' },
  { id: '3', word: 'toki pona', translation: 'токипона', partOfSpeech: 'phrase' },
  { id: '4', word: 'Ēlen', translation: 'звезда', partOfSpeech: 'noun' },
];
const index = buildDictionaryIndex(entries);

describe('segmentText', () => {
  it('без словаря возвращает текст целиком', () => {
    expect(segmentText('abc', buildDictionaryIndex([]))).toEqual([{ text: 'abc' }]);
  });

  it('жадно находит словосочетание раньше отдельных слов', () => {
    const segments = segmentText('mi toki pona.', index);
    expect(segments.map((s) => s.text)).toEqual(['mi ', 'toki pona', '.']);
    expect(segments[1].entries[0].id).toBe('3');
  });

  it('без регистра и с диакритикой', () => {
    const segments = segmentText('ĒLEN síla', index);
    expect(segments[0]).toMatchObject({ text: 'ĒLEN' });
    expect(segments[0].entries[0].id).toBe('4');
  });

  it('не склеивает словосочетание через знак препинания', () => {
    const segments = segmentText('toki, pona', index);
    expect(segments.filter((s) => s.entries).map((s) => s.entries[0].id)).toEqual(['1', '2']);
  });

  it('не находит слово внутри другого слова', () => {
    expect(segmentText('tokipona', index)).toEqual([{ text: 'tokipona' }]);
  });

  it('сохраняет исходный текст без потерь', () => {
    const text = '  toki  pona! Ēlen? ';
    expect(segmentText(text, index).map((s) => s.text).join('')).toBe(text);
  });
});

describe('filterDictionary', () => {
  it('ищет по слову и переводу, без регистра', () => {
    expect(filterDictionary(entries, { search: 'ЗВЕЗ' }).map((e) => e.id)).toEqual(['4']);
    expect(filterDictionary(entries, { search: 'tok' }).map((e) => e.id)).toEqual(['1', '3']);
  });

  it('фильтрует по части речи', () => {
    expect(filterDictionary(entries, { partOfSpeech: 'noun' }).map((e) => e.id)).toEqual(['4', '1']);
  });

  it('сортирует по переводу по убыванию', () => {
    expect(filterDictionary(entries, { sort: 'translation-desc' }).map((e) => e.translation)[0]).toBe('язык, речь');
  });
});

describe('collectLessonWords', () => {
  const index = buildDictionaryIndex([
    { id: 'hola', word: 'hola' },
    { id: 'me-llamo', word: 'me llamo' },
    { id: 'yo', word: 'yo' },
    { id: 'ana', word: 'Ana' },
  ]);

  it('находит слова и словосочетания в абзацах и заголовках без повторов, в порядке текста', () => {
    const blocks = [
      { type: 'heading', children: [{ text: '¡Hola!' }] },
      { type: 'paragraph', children: [{ text: 'Yo me llamo Pablo. ¡Hola, ' }, { text: 'hola', bold: true }] },
      { type: 'table', rows: [{ cells: ['Ana'] }] },
    ];
    expect(collectLessonWords(blocks, index).map((e) => e.id)).toEqual(['hola', 'yo', 'me-llamo']);
  });

  it('ручная привязка dictRef учитывается, даже если текст не совпадает; битая — пропускается', () => {
    const blocks = [{ type: 'paragraph', children: [{ text: 'Анечка', dictRef: 'ana' }, { text: 'x', dictRef: 'нет' }] }];
    expect(collectLessonWords(blocks, index).map((e) => e.id)).toEqual(['ana']);
  });

  it('пустой словарь или урок — пустой список', () => {
    expect(collectLessonWords([], index)).toEqual([]);
    expect(collectLessonWords([{ type: 'paragraph', children: [{ text: 'hola' }] }], buildDictionaryIndex([]))).toEqual([]);
    expect(collectLessonWords(undefined, null)).toEqual([]);
  });
});
