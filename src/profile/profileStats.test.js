import { describe, expect, it } from 'vitest';
import { computeBadges, computeProfileStats } from './profileStats.js';

describe('computeProfileStats', () => {
  it('нет курсов и оценок', () => {
    expect(computeProfileStats([])).toEqual({
      coursesCount: 0,
      likes: 0,
      dislikes: 0,
      approval: null,
      commentsCount: 0,
      points: 0,
      bestStreak: 0,
      reviewsCount: 0,
      completedCourses: 0,
    });
  });
  it('доля положительных оценок по всем курсам', () => {
    const stats = computeProfileStats([{ likesCount: 3, dislikesCount: 1 }, { likesCount: 5 }, {}], 4);
    expect(stats).toMatchObject({ coursesCount: 3, likes: 8, dislikes: 1, approval: 89, commentsCount: 4 });
  });
});

describe('computeBadges', () => {
  const earned = (stats) => computeBadges(stats).filter((b) => b.earned).map((b) => b.id);
  it('новичок без бейджей, но видит, как их получить', () => {
    const badges = computeBadges(computeProfileStats([]));
    expect(badges).toHaveLength(8);
    expect(badges.every((b) => !b.earned && b.hint)).toBe(true);
  });
  it('пороги', () => {
    expect(earned({ coursesCount: 1, likes: 24, commentsCount: 9 })).toEqual(['author']);
    expect(earned({ coursesCount: 0, likes: 25, commentsCount: 10 })).toEqual(['favorite', 'talker']);
  });
  it('учебные значки (v2): серии 7 и 30, 100 слов, пройденные курсы', () => {
    const learning = (l, done) => computeProfileStats([], 0, l, done);
    expect(earned(learning({ bestStreak: 6, reviewsCount: 99 }, 0))).toEqual([]);
    expect(earned(learning({ bestStreak: 7, reviewsCount: 100 }, 1))).toEqual(['streak7', 'reviewer', 'graduate']);
    expect(earned(learning({ bestStreak: 30 }, 5))).toEqual(['streak7', 'streak30', 'graduate', 'graduate5']);
  });
});
