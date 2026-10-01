import { describe, expect, it } from 'vitest';
import { SRS_LIMITS, formatInterval, newCardState, reviewCard, srsCardId } from './srs.js';

const run = (grades, start = newCardState()) => grades.reduce((card, g) => ({ ...card, ...reviewCard(card, g) }), start);

describe('SRS: упрощённый SM-2', () => {
  it('новая карточка: «Вспомнил» 1 → 3 → интервал × лёгкость', () => {
    expect(run(['good']).interval).toBe(1);
    expect(run(['good', 'good']).interval).toBe(3);
    expect(run(['good', 'good', 'good']).interval).toBe(Math.round(3 * 2.5));
  });

  it('«Забыл» сбрасывает повторения, возвращает через 10 минут и снижает лёгкость', () => {
    const card = run(['good', 'good', 'again']);
    expect(card).toMatchObject({ interval: 0, repetitions: 0, dueMinutes: SRS_LIMITS.RELEARN_MINUTES });
    expect(card.easeFactor).toBe(2.3);
  });

  it('лёгкость не выходит за 1.3–3.0, интервал — за 10 лет', () => {
    expect(run(Array(20).fill('again')).easeFactor).toBe(SRS_LIMITS.EASE_MIN);
    const easy = run(Array(40).fill('easy'));
    expect(easy.easeFactor).toBe(SRS_LIMITS.EASE_MAX);
    expect(easy.interval).toBe(SRS_LIMITS.INTERVAL_MAX);
  });

  it('интервал всегда растёт при успешном ответе, «Трудно» растёт медленнее «Вспомнил»', () => {
    const base = run(['good', 'good', 'good']);
    const hard = reviewCard(base, 'hard');
    const good = reviewCard(base, 'good');
    const easy = reviewCard(base, 'easy');
    expect(hard.interval).toBeGreaterThan(base.interval);
    expect(hard.interval).toBeLessThan(good.interval);
    expect(easy.interval).toBeGreaterThan(good.interval);
    expect(reviewCard({ interval: 1, repetitions: 5, easeFactor: 1.3 }, 'hard').interval).toBe(2);
  });

  it('целые интервалы и срок в минутах для правил', () => {
    const r = reviewCard({ interval: 7, repetitions: 3, easeFactor: 2.37 }, 'good');
    expect(Number.isInteger(r.interval)).toBe(true);
    expect(r.dueMinutes).toBe(r.interval * 1440);
  });

  it('битые данные карточки не ломают расчёт, неизвестная оценка — ошибка', () => {
    expect(reviewCard({ interval: 'x', easeFactor: null }, 'good')).toMatchObject({ interval: 1, repetitions: 1, easeFactor: 2.5 });
    expect(() => reviewCard(newCardState(), 'super')).toThrow();
  });

  it('подписи интервалов и id карточки', () => {
    expect(formatInterval(10)).toBe('10 мин');
    expect(formatInterval(1440)).toBe('1 д.');
    expect(formatInterval(1440 * 90)).toBe('3 мес.');
    expect(srsCardId('c1', 'w1')).toBe('c1_w1');
  });
});
