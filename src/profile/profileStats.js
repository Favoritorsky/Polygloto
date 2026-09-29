/**
 * Статистика и бейджи профиля. Считаются на клиенте из уже загруженных
 * данных (опубликованные курсы + счётчик комментариев в users), поэтому их
 * нельзя «накрутить»: все исходные числа пишет только сервер.
 */

export function computeProfileStats(courses, profile) {
  const likes = courses.reduce((sum, c) => sum + (c.likesCount ?? 0), 0);
  const dislikes = courses.reduce((sum, c) => sum + (c.dislikesCount ?? 0), 0);
  const votes = likes + dislikes;
  return {
    coursesCount: courses.length,
    likes,
    dislikes,
    // Средний рейтинг — доля положительных оценок по всем курсам автора.
    approval: votes > 0 ? Math.round((likes / votes) * 100) : null,
    commentsCount: profile?.commentsCount ?? 0,
  };
}

export const BADGES = Object.freeze([
  {
    id: 'author',
    icon: '📚',
    title: 'Автор',
    hint: 'Опубликовать первый курс',
    earned: (s) => s.coursesCount >= 1,
  },
  {
    id: 'favorite',
    icon: '⭐',
    title: 'Любимец публики',
    hint: 'Собрать 25 лайков на своих курсах',
    earned: (s) => s.likes >= 25,
  },
  {
    id: 'talker',
    icon: '💬',
    title: 'Собеседник',
    hint: 'Оставить 10 комментариев',
    earned: (s) => s.commentsCount >= 10,
  },
]);

export function computeBadges(stats) {
  return BADGES.map(({ earned, ...badge }) => ({ ...badge, earned: earned(stats) }));
}
