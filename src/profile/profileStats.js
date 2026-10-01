/**
 * Статистика и бейджи профиля. Считаются на клиенте из опубликованных курсов
 * (их счётчики оценок правила меняют только вместе с голосами) и числа
 * комментариев (запрос count() по самим комментариям), поэтому «накрутить»
 * их можно только настоящими голосами и комментариями.
 *
 * Учебные показатели (v2) — из userStats/{uid} (правила меняют их только
 * вместе с настоящим заданием, повторением или уроком) и числа отметок
 * users/{uid}/completedCourses.
 */

export function computeProfileStats(courses, commentsCount = 0, learning = null, completedCourses = 0) {
  const likes = courses.reduce((sum, c) => sum + (c.likesCount ?? 0), 0);
  const dislikes = courses.reduce((sum, c) => sum + (c.dislikesCount ?? 0), 0);
  const votes = likes + dislikes;
  return {
    coursesCount: courses.length,
    likes,
    dislikes,
    // Средний рейтинг — доля положительных оценок по всем курсам автора.
    approval: votes > 0 ? Math.round((likes / votes) * 100) : null,
    commentsCount,
    points: learning?.points ?? 0,
    bestStreak: learning?.bestStreak ?? 0,
    reviewsCount: learning?.reviewsCount ?? 0,
    completedCourses,
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
  {
    id: 'streak7',
    icon: '🔥',
    title: 'Неделя подряд',
    hint: 'Заниматься 7 дней подряд',
    earned: (s) => s.bestStreak >= 7,
  },
  {
    id: 'streak30',
    icon: '🏔️',
    title: 'Месяц без перерыва',
    hint: 'Заниматься 30 дней подряд',
    earned: (s) => s.bestStreak >= 30,
  },
  {
    id: 'reviewer',
    icon: '🧠',
    title: 'Память как сталь',
    hint: 'Вспомнить 100 слов в повторении',
    earned: (s) => s.reviewsCount >= 100,
  },
  {
    id: 'graduate',
    icon: '🎓',
    title: 'Выпускник',
    hint: 'Пройти все уроки курса',
    earned: (s) => s.completedCourses >= 1,
  },
  {
    id: 'graduate5',
    icon: '🏅',
    title: 'Полиглот',
    hint: 'Пройти 5 курсов',
    earned: (s) => s.completedCourses >= 5,
  },
]);

export function computeBadges(stats) {
  return BADGES.map(({ earned, ...badge }) => ({ ...badge, earned: earned(stats) }));
}
