/**
 * Мини-игры по словарю курса (v2): «Найди пары» и «На скорость».
 * Очков рейтинга не дают (правила не могут проверить результат игры);
 * лучший результат хранится в браузере.
 */
import { normalizeText } from '../../shared/schema.js';

export const GAME_LIMITS = Object.freeze({ MIN_WORDS: 4, PAIRS: 6, SPEED_SECONDS: 60, OPTIONS: 4 });

export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Слова, пригодные для игр: с текстом и переводом, без повторов по переводу и по слову. */
export function playableWords(entries) {
  const seenWord = new Set();
  const seenTranslation = new Set();
  return (entries ?? []).filter((e) => {
    const w = normalizeText(e.word ?? '');
    const t = normalizeText(e.translation ?? '');
    if (!w || !t || seenWord.has(w) || seenTranslation.has(t)) return false;
    seenWord.add(w);
    seenTranslation.add(t);
    return true;
  });
}

/** Карточки для «Найди пары»: по две на слово (слово и перевод), перемешаны. */
export function makeMemoryCards(entries, pairs = GAME_LIMITS.PAIRS, random = Math.random) {
  const chosen = shuffle(playableWords(entries), random).slice(0, pairs);
  const cards = chosen.flatMap((e) => [
    { key: `${e.id}:w`, pairId: e.id, text: e.word, side: 'word' },
    { key: `${e.id}:t`, pairId: e.id, text: e.translation, side: 'translation' },
  ]);
  return shuffle(cards, random);
}

/**
 * Вопрос для «На скорость»: слово и варианты перевода (один верный).
 * previousId — чтобы одно слово не выпадало два раза подряд.
 */
export function makeSpeedQuestion(entries, previousId = null, random = Math.random) {
  const words = playableWords(entries);
  if (words.length < 2) return null;
  const pool = words.length > 2 ? words.filter((w) => w.id !== previousId) : words;
  const answer = pool[Math.floor(random() * pool.length)];
  const distractors = shuffle(
    words.filter((w) => w.id !== answer.id),
    random,
  ).slice(0, GAME_LIMITS.OPTIONS - 1);
  const options = shuffle([answer, ...distractors], random).map((w) => ({ id: w.id, text: w.translation }));
  return { id: answer.id, word: answer.word, options };
}

const storageKey = (game, courseId) => `polygloto:best:${game}:${courseId}`;

/** Лучший результат из браузера (null, если нет или хранилище недоступно). */
export function readBest(game, courseId) {
  try {
    const value = Number(window.localStorage.getItem(storageKey(game, courseId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Сохраняет результат, если он лучше. better(a, b) — true, если a лучше b. Возвращает true при рекорде. */
export function saveBest(game, courseId, value, better) {
  const previous = readBest(game, courseId);
  if (previous !== null && !better(value, previous)) return false;
  try {
    window.localStorage.setItem(storageKey(game, courseId), String(value));
  } catch {
    /* хранилище недоступно — рекорд просто не запомнится */
  }
  return true;
}
