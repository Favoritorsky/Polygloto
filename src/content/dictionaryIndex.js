/**
 * Индекс словаря курса для «активных ссылок»: при рендере текст разбивается
 * на слова, и те, что есть в словаре (в т.ч. словосочетания до MAX_PHRASE слов),
 * подсвечиваются. Ручная привязка автора (leaf.dictRef) имеет приоритет.
 */
import { normalizeText } from '../../shared/schema.js';

export const MAX_PHRASE_WORDS = 4;

// Слово: буквы/цифры с внутренними апострофами и дефисами (ʻokina, l'eau, to-do).
const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’ʼ-][\p{L}\p{M}\p{N}]+)*/gu;

export function buildDictionaryIndex(entries) {
  const byId = new Map();
  const byText = new Map();
  for (const entry of entries ?? []) {
    byId.set(entry.id, entry);
    const key = normalizeText(entry.word);
    if (!key) continue;
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(entry);
  }
  return { byId, byText, size: byId.size };
}

/**
 * Разбивает текст на сегменты: { text } или { text, entries } для совпадений.
 * Совпадения ищутся жадно: сначала самое длинное словосочетание.
 */
export function segmentText(text, index) {
  if (!text || !index || index.byText.size === 0) return [{ text }];
  const words = [...text.matchAll(WORD_RE)].map((m) => ({ start: m.index, end: m.index + m[0].length, word: m[0] }));
  const segments = [];
  let cursor = 0;
  let i = 0;
  while (i < words.length) {
    let matched = null;
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n -= 1) {
      const phrase = words
        .slice(i, i + n)
        .map((w) => w.word)
        .join(' ');
      const entries = index.byText.get(normalizeText(phrase));
      // Словосочетание засчитываем, только если между словами лишь пробелы.
      const gapOk = words.slice(i, i + n - 1).every((w, k) => /^\s+$/.test(text.slice(w.end, words[i + k + 1].start)));
      if (entries && (n === 1 || gapOk)) {
        matched = { n, entries };
        break;
      }
    }
    if (matched) {
      const start = words[i].start;
      const end = words[i + matched.n - 1].end;
      if (start > cursor) segments.push({ text: text.slice(cursor, start) });
      segments.push({ text: text.slice(start, end), entries: matched.entries });
      cursor = end;
      i += matched.n;
    } else {
      i += 1;
    }
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** Фильтрация и сортировка словаря для читателя/автора. */
export function filterDictionary(entries, { search = '', partOfSpeech = 'all', sort = 'word-asc' } = {}) {
  const q = normalizeText(search);
  const filtered = (entries ?? []).filter((e) => {
    if (partOfSpeech !== 'all' && e.partOfSpeech !== partOfSpeech) return false;
    if (!q) return true;
    return normalizeText(e.word).includes(q) || normalizeText(e.translation).includes(q);
  });
  const collator = new Intl.Collator('ru', { sensitivity: 'base' });
  const [field, dir] = sort.split('-');
  const key = field === 'translation' ? 'translation' : field === 'pos' ? 'partOfSpeech' : 'word';
  filtered.sort((a, b) => collator.compare(a[key] ?? '', b[key] ?? '') * (dir === 'desc' ? -1 : 1) || collator.compare(a.word, b.word));
  return filtered;
}

/**
 * Слова словаря, встречающиеся в уроке: ручные привязки (dictRef) и
 * автоматические совпадения в тексте абзацев и заголовков. Порядок — как в
 * тексте, без повторов. Нужен, чтобы добавить слова урока в повторение.
 */
export function collectLessonWords(blocks, index) {
  if (!index || index.size === 0) return [];
  const found = new Map();
  const add = (entry) => entry && !found.has(entry.id) && found.set(entry.id, entry);
  for (const block of blocks ?? []) {
    for (const leaf of block.children ?? []) {
      if (leaf.dictRef) {
        add(index.byId.get(leaf.dictRef));
        continue;
      }
      for (const segment of segmentText(leaf.text ?? '', index)) segment.entries?.forEach(add);
    }
  }
  return [...found.values()];
}
