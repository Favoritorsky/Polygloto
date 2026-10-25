import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, buildCourseExport, exportFileName, parseCourseImport } from './courseExport.js';

const AUDIO = 'data:audio/ogg;base64,T2dnUw==';
const course = {
  title: 'Испанский с нуля',
  language: 'Испанский',
  description: 'Описание',
  categories: [{ id: 'g_noun', name: 'Сущ.', color: '#2a9d8f' }],
};
const lessons = [
  {
    title: 'Урок 1',
    blocks: [
      { type: 'paragraph', children: [{ text: 'Hola', dictRef: 'w1', category: 'g_noun', onclick: 'x' }] },
      {
        type: 'task',
        id: 't1',
        taskType: 'listening',
        data: { audio: { kind: 'file', id: 'a1' }, question: 'q', options: [], answers: ['hola'], mode: 'input' },
      },
      { type: 'script', html: '<b>' },
    ],
  },
];
const dictionary = [{ id: 'w1', word: 'hola', translation: 'привет', partOfSpeech: 'interjection', examples: [], notes: '', pronunciation: '[ˈo.la]', createdAt: 1 }];
const audio = [
  { id: 'a1', dataUrl: AUDIO, name: 'hola.ogg' },
  { id: 'unused', dataUrl: AUDIO, name: 'x.ogg' },
];

describe('экспорт', () => {
  const file = buildCourseExport({ course, lessons, reference: [], dictionary, audio }, new Date('2026-10-01T00:00:00Z'));
  it('формат, версия и очищенный контент', () => {
    expect(file.format).toBe('polygloto-course');
    expect(file.version).toBe(1);
    expect(file.lessons[0].blocks).toHaveLength(2);
    expect(file.lessons[0].blocks[0].children[0]).toEqual({ text: 'Hola', dictRef: 'w1', category: 'g_noun' });
    expect(file.dictionary[0]).toEqual({
      id: 'w1',
      word: 'hola',
      translation: 'привет',
      partOfSpeech: 'interjection',
      examples: [],
      notes: '',
      pronunciation: '[ˈo.la]',
    });
  });
  it('только используемые аудиофайлы', () => {
    expect(file.audio.map((a) => a.id)).toEqual(['a1']);
  });
  it('экспорт → импорт сохраняет курс', () => {
    const { data, error } = parseCourseImport(JSON.stringify(file));
    expect(error).toBeUndefined();
    expect(data.course.title).toBe(course.title);
    expect(data.lessons).toEqual(file.lessons);
    expect(data.dictionary).toEqual(file.dictionary);
    expect(data.audio).toEqual(file.audio);
    expect(data.warnings).toEqual([]);
  });
});

describe('импорт', () => {
  const base = { format: 'polygloto-course', version: 1, course: { title: 'Курс', language: 'Язык' }, lessons: [], dictionary: [] };
  const words = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `w${i}`, word: `слово${i}`, translation: `перевод ${i}`, partOfSpeech: 'noun', examples: [], notes: '' }));
  it('словарь до 25 000 слов, с 8 000 — предупреждение о лимите записей', () => {
    expect(IMPORT_LIMITS.WORDS_MAX).toBe(25000);
    const small = parseCourseImport(JSON.stringify({ ...base, dictionary: words(5003) })).data;
    expect(small.dictionary).toHaveLength(5003);
    expect(small.warnings).toEqual([]);
    const big = parseCourseImport(JSON.stringify({ ...base, dictionary: words(25001) })).data;
    expect(big.dictionary).toHaveLength(25000);
    expect(big.warnings.join(' ')).toMatch(/взяты первые 25000 из 25001/);
    expect(big.warnings.join(' ')).toMatch(/20 000 документов в сутки/);
  });
  it('понятные ошибки для чужих и битых файлов', () => {
    expect(parseCourseImport('{').error).toMatch(/не JSON/);
    expect(parseCourseImport('{"a":1}').error).toMatch(/не файл курса/);
    expect(parseCourseImport(JSON.stringify({ ...base, version: 99 })).error).toMatch(/Версия файла 99/);
    expect(parseCourseImport(JSON.stringify({ ...base, course: { title: 'x', language: 'Язык' } })).error).toMatch(/названия/);
    expect(parseCourseImport(JSON.stringify({ ...base, course: { title: 'Курс' } })).error).toMatch(/язык/);
  });
  it('пустой курс получает один урок', () => {
    expect(parseCourseImport(JSON.stringify(base)).data.lessons).toEqual([{ title: 'Урок 1', blocks: [] }]);
  });
  it('плохие слова и дубли пропускаются с предупреждением', () => {
    const { data } = parseCourseImport(
      JSON.stringify({
        ...base,
        dictionary: [
          { id: 'w1', word: 'a', translation: 'b' },
          { id: 'w1', word: 'c', translation: 'd' },
          { id: '../x', word: 'e', translation: 'f' },
          { id: 'w2', word: '', translation: 'g' },
        ],
      }),
    );
    expect(data.dictionary.map((w) => w.id)).toEqual(['w1']);
    expect(data.warnings).toContain('Пропущено слов с ошибками: 3.');
  });
  it('аудио: не-аудио отбрасывается, о недостающих предупреждает', () => {
    const { data } = parseCourseImport(
      JSON.stringify({
        ...base,
        lessons,
        audio: [{ id: 'a1', dataUrl: 'data:text/html;base64,PGI+' }],
      }),
    );
    expect(data.audio).toEqual([]);
    expect(data.warnings.join(' ')).toMatch(/не хватает аудиозаписей: 1/);
  });
  it('лимиты: лишние уроки обрезаются', () => {
    const many = Array.from({ length: 205 }, (_, i) => ({ title: `У${i}`, blocks: [] }));
    const { data } = parseCourseImport(JSON.stringify({ ...base, lessons: many }));
    expect(data.lessons).toHaveLength(200);
    expect(data.warnings[0]).toMatch(/первые 200 из 205/);
  });
});

it('имя файла', () => {
  expect(exportFileName('Испанский: с нуля!', new Date('2026-10-01T00:00:00Z'))).toBe('ispanskii-s-nulya-2026-10-01.polygloto.json');
  expect(exportFileName('Español básico', new Date('2026-10-01T00:00:00Z'))).toBe('espanol-basico-2026-10-01.polygloto.json');
  expect(exportFileName('日本語', new Date('2026-10-01T00:00:00Z'))).toBe('course-2026-10-01.polygloto.json');
  expect(exportFileName('', new Date('2026-10-01T00:00:00Z'))).toBe('course-2026-10-01.polygloto.json');
});
