/**
 * Подстрочный разбор (interlinear gloss, v2) по Лейпцигским правилам:
 * исходная строка и строка разбора делятся по пробелам и выравниваются по
 * словам; морфемы внутри слова — через дефис (или «=», «.»), грамматические
 * пометы пишутся заглавными (PL, 1SG, PST) и показываются капителью.
 */

export const GLOSS_LIMITS = Object.freeze({ LINE_MAX: 1000, WORDS_MAX: 60 });

const words = (text) =>
  String(text ?? '')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

/** Выравнивание по словам: [{ word, gloss }]; лишние слова любой строки сохраняются. */
export function alignGloss(source, gloss) {
  const a = words(source).slice(0, GLOSS_LIMITS.WORDS_MAX);
  const b = words(gloss).slice(0, GLOSS_LIMITS.WORDS_MAX);
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => ({ word: a[i] ?? '', gloss: b[i] ?? '' }));
}

/** Есть ли расхождение числа слов (подсказка автору). */
export function glossMismatch(source, gloss) {
  const a = words(source).length;
  const b = words(gloss).length;
  return a !== b && a > 0 && b > 0 ? { source: a, gloss: b } : null;
}

const LABEL_RE = /^(?=.*[A-Z])[A-Z0-9]{2,}$/;
const PERSON_RE = /^[123]$/;

/**
 * Делит слово разбора на части: разделители морфем и пометы. Помета — от двух
 * заглавных латинских букв и цифр (PL, 3SG, PST) или номер лица (1, 2, 3);
 * одиночная заглавная буква (английское «I») пометой не считается.
 */
export function glossParts(token) {
  return String(token)
    .split(/([-=.:])/u)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, label: LABEL_RE.test(part) || PERSON_RE.test(part) }));
}
