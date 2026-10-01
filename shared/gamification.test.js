import { describe, expect, it } from 'vitest';
import {
  POINTS,
  applyStatsEvent,
  currentStreak,
  currentWeekPoints,
  dailyQuests,
  dayIndex,
  emptyStats,
  questProgress,
  weekIndex,
} from './gamification.js';

const DAY = 86400000;
const at = (iso) => Date.parse(iso);

describe('дни и недели (UTC)', () => {
  it('день меняется в полночь UTC', () => {
    expect(dayIndex(at('2026-10-01T23:59:59Z'))).toBe(dayIndex(at('2026-10-01T00:00:00Z')));
    expect(dayIndex(at('2026-10-02T00:00:00Z'))).toBe(dayIndex(at('2026-10-01T00:00:00Z')) + 1);
  });
  it('неделя начинается в понедельник', () => {
    const sunday = dayIndex(at('2026-10-04T12:00:00Z'));
    const monday = dayIndex(at('2026-10-05T12:00:00Z'));
    expect(weekIndex(monday)).toBe(weekIndex(sunday) + 1);
    expect(weekIndex(dayIndex(at('2026-10-11T12:00:00Z')))).toBe(weekIndex(monday));
  });
});

describe('applyStatsEvent', () => {
  const t0 = at('2026-10-01T10:00:00Z');
  it('первое задание: очки, серия 1, счётчики', () => {
    const s = applyStatsEvent(null, 'task', { correct: true }, t0);
    expect(s).toMatchObject({ points: 10, streak: 1, bestStreak: 1, tasksCount: 1, dayTasks: 1, weekPoints: 10, dayIndex: dayIndex(t0) });
    expect(applyStatsEvent(null, 'task', { correct: false }, t0).points).toBe(POINTS.TASK_WRONG);
  });
  it('серия растёт по дням и обнуляется после пропуска', () => {
    let s = applyStatsEvent(null, 'review', { scored: false }, t0);
    s = applyStatsEvent(s, 'task', { correct: true }, t0 + 3600000);
    expect(s.streak).toBe(1);
    s = applyStatsEvent(s, 'task', { correct: true }, t0 + DAY);
    s = applyStatsEvent(s, 'review', { scored: true }, t0 + 2 * DAY);
    expect(s.streak).toBe(3);
    s = applyStatsEvent(s, 'task', { correct: true }, t0 + 4 * DAY);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(3);
  });
  it('урок даёт очки, но не продлевает серию', () => {
    const s = applyStatsEvent(applyStatsEvent(null, 'task', { correct: true }, t0), 'lesson', {}, t0 + DAY);
    expect(s.points).toBe(30);
    expect(s.streak).toBe(1);
    expect(s.lastActiveDay).toBe(dayIndex(t0));
    expect(s.dayLessons).toBe(1);
    expect(s.dayTasks).toBe(0);
  });
  it('повторение: очки и счётчик слов только для «засчитанного»', () => {
    const a = applyStatsEvent(null, 'review', { scored: false }, t0);
    expect(a).toMatchObject({ points: 0, reviewsCount: 0, dayReviews: 1, streak: 1 });
    const b = applyStatsEvent(a, 'review', { scored: true }, t0);
    expect(b).toMatchObject({ points: 2, reviewsCount: 1, dayReviews: 2 });
  });
  it('недельные очки сбрасываются в понедельник, общие — нет', () => {
    const sunday = at('2026-10-04T20:00:00Z');
    let s = applyStatsEvent(null, 'lesson', {}, sunday);
    s = applyStatsEvent(s, 'task', { correct: true }, sunday + 6 * 3600000);
    expect(s.weekPoints).toBe(10);
    expect(s.points).toBe(30);
  });
});

describe('показ', () => {
  const t0 = at('2026-10-01T10:00:00Z');
  const s = applyStatsEvent(emptyStats(), 'task', { correct: true }, t0);
  it('серия видна сегодня и завтра, послезавтра — 0', () => {
    expect(currentStreak(s, t0)).toBe(1);
    expect(currentStreak(s, t0 + DAY)).toBe(1);
    expect(currentStreak(s, t0 + 2 * DAY)).toBe(0);
    expect(currentStreak(null, t0)).toBe(0);
  });
  it('очки недели — только текущей', () => {
    expect(currentWeekPoints(s, t0)).toBe(10);
    expect(currentWeekPoints(s, t0 + 7 * DAY)).toBe(0);
  });
});

describe('ежедневные задания', () => {
  it('три разных задания на любой день', () => {
    for (let day = 20000; day < 20012; day += 1) {
      const ids = dailyQuests(day).map((q) => q.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });
  it('прогресс берётся из сегодняшних счётчиков', () => {
    const t0 = at('2026-10-01T10:00:00Z');
    let s = null;
    for (let i = 0; i < 5; i += 1) s = applyStatsEvent(s, 'task', { correct: true }, t0);
    const today = questProgress(s, t0);
    const taskQuest = today.find((q) => q.counter === 'tasks');
    expect(taskQuest.done).toBe(true);
    expect(questProgress(s, t0 + DAY).every((q) => q.progress === 0)).toBe(true);
  });
});
