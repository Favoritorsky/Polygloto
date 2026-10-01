/**
 * Интервальные повторения (SRS): упрощённый SM-2, как в Anki.
 *
 * Карточка: { interval (дни, целое), easeFactor (1.3–3.0), repetitions }.
 * Оценки: again «Забыл», hard «Трудно», good «Вспомнил», easy «Легко».
 *  - again: карточка начинается заново и вернётся через 10 минут, лёгкость −0.2;
 *  - hard: интервал растёт медленно (×1.2), лёгкость −0.15;
 *  - good: 1 день → 3 дня → интервал × лёгкость;
 *  - easy: 4 дня → интервал × лёгкость × 1.3, лёгкость +0.15.
 * Правила Firestore проверяют форму результата (диапазоны, срок = сейчас +
 * интервал), а не саму арифметику: исказить можно только своё расписание.
 */

export const SRS_LIMITS = Object.freeze({
  EASE_MIN: 1.3,
  EASE_MAX: 3,
  EASE_START: 2.5,
  INTERVAL_MAX: 3650,
  RELEARN_MINUTES: 10,
});

export const SRS_GRADES = Object.freeze([
  { id: 'again', label: 'Забыл' },
  { id: 'hard', label: 'Трудно' },
  { id: 'good', label: 'Вспомнил' },
  { id: 'easy', label: 'Легко' },
]);

const round2 = (n) => Math.round(n * 100) / 100;
const clampEase = (e) => round2(Math.min(SRS_LIMITS.EASE_MAX, Math.max(SRS_LIMITS.EASE_MIN, e)));
const clampInterval = (i) => Math.min(SRS_LIMITS.INTERVAL_MAX, Math.max(1, Math.round(i)));

export function newCardState() {
  return { interval: 0, easeFactor: SRS_LIMITS.EASE_START, repetitions: 0 };
}

/** Следующее состояние карточки после оценки. dueMinutes — через сколько минут показать снова. */
export function reviewCard(card, grade) {
  const interval = Number.isInteger(card?.interval) ? card.interval : 0;
  const repetitions = Number.isInteger(card?.repetitions) ? card.repetitions : 0;
  const ease = typeof card?.easeFactor === 'number' ? card.easeFactor : SRS_LIMITS.EASE_START;

  if (grade === 'again') {
    return { interval: 0, repetitions: 0, easeFactor: clampEase(ease - 0.2), dueMinutes: SRS_LIMITS.RELEARN_MINUTES };
  }
  let next;
  let nextEase = ease;
  if (grade === 'hard') {
    next = repetitions === 0 ? 1 : Math.max(interval + 1, interval * 1.2);
    nextEase = ease - 0.15;
  } else if (grade === 'good') {
    next = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(interval + 1, interval * ease);
  } else if (grade === 'easy') {
    next = repetitions === 0 ? 4 : Math.max(interval + 2, interval * ease * 1.3);
    nextEase = ease + 0.15;
  } else {
    throw new Error(`Неизвестная оценка: ${grade}`);
  }
  const days = clampInterval(next);
  return { interval: days, repetitions: repetitions + 1, easeFactor: clampEase(nextEase), dueMinutes: days * 24 * 60 };
}

/** Подпись интервала для кнопок оценки: «10 мин», «1 д.», «3 мес.». */
export function formatInterval(minutes) {
  if (minutes < 60) return `${minutes} мин`;
  const days = Math.round(minutes / 1440);
  if (days < 31) return `${days} д.`;
  if (days < 365) return `${Math.round(days / 30)} мес.`;
  return `${Math.round((days / 365) * 10) / 10} г.`;
}

/** id карточки: одно слово курса — одна карточка у читателя. */
export function srsCardId(courseId, wordId) {
  return `${courseId}_${wordId}`;
}
