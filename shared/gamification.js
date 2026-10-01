/**
 * Геймификация (v2): очки, серия дней, дневные счётчики для ежедневных
 * заданий и недельные очки для рейтинга. Документ userStats/{uid} меняется
 * только вместе с событием, которое это оправдывает (firestore.rules
 * повторяют applyStatsEvent):
 *  - task — первая попытка задания (отметка users/{uid}/taskResults);
 *  - review — повторение карточки (users/{uid}/srsCards);
 *  - lesson — урок пройден впервые (users/{uid}/lessonProgress).
 * Дни считаются по UTC: так одинаково у всех и в правилах (request.time).
 */

export const POINTS = Object.freeze({
  TASK_CORRECT: 10,
  TASK_WRONG: 2,
  /** Повторение карточки, которую уже повторяли раньше, с оценкой «вспомнил». */
  REVIEW: 2,
  LESSON: 20,
});

export const STATS_EVENTS = Object.freeze(['task', 'review', 'lesson']);

const DAY_MS = 86400000;

/** Номер дня по UTC (дни с 1970-01-01). */
export function dayIndex(ms) {
  return Math.floor(ms / DAY_MS);
}

/** Номер недели (с понедельника, UTC): 1970-01-01 — четверг, поэтому +3. */
export function weekIndex(day) {
  return Math.floor((day + 3) / 7);
}

/** Дата начала дня по его номеру (для подписей). */
export function dayStart(day) {
  return new Date(day * DAY_MS);
}

export function emptyStats() {
  return {
    points: 0,
    streak: 0,
    bestStreak: 0,
    lastActiveDay: -1,
    tasksCount: 0,
    reviewsCount: 0,
    lessonsCount: 0,
    dayIndex: -1,
    dayTasks: 0,
    dayReviews: 0,
    dayLessons: 0,
    weekIndex: -1,
    weekPoints: 0,
  };
}

/**
 * Очки за событие.
 * task: { correct }; review: { scored } — карточку уже повторяли и вспомнили; lesson: {}.
 */
export function eventPoints(type, detail = {}) {
  if (type === 'task') return detail.correct ? POINTS.TASK_CORRECT : POINTS.TASK_WRONG;
  if (type === 'review') return detail.scored ? POINTS.REVIEW : 0;
  if (type === 'lesson') return POINTS.LESSON;
  return 0;
}

/**
 * Новое состояние userStats после события (без служебных полей lastEvent,
 * lastEventId, updatedAt — их добавляет сервис).
 */
export function applyStatsEvent(previous, type, detail, nowMs) {
  const old = { ...emptyStats(), ...(previous ?? {}) };
  const today = dayIndex(nowMs);
  const week = weekIndex(today);
  const delta = eventPoints(type, detail);
  const sameDay = old.dayIndex === today;
  // Серия — дни, в которые было задание или повторение.
  const active = type === 'task' || type === 'review';
  let { streak, bestStreak, lastActiveDay } = old;
  if (active && lastActiveDay !== today) {
    streak = lastActiveDay === today - 1 ? streak + 1 : 1;
    lastActiveDay = today;
    bestStreak = Math.max(bestStreak, streak);
  }
  return {
    points: old.points + delta,
    streak,
    bestStreak,
    lastActiveDay,
    tasksCount: old.tasksCount + (type === 'task' ? 1 : 0),
    reviewsCount: old.reviewsCount + (type === 'review' && detail.scored ? 1 : 0),
    lessonsCount: old.lessonsCount + (type === 'lesson' ? 1 : 0),
    dayIndex: today,
    dayTasks: (sameDay ? old.dayTasks : 0) + (type === 'task' ? 1 : 0),
    dayReviews: (sameDay ? old.dayReviews : 0) + (type === 'review' ? 1 : 0),
    dayLessons: (sameDay ? old.dayLessons : 0) + (type === 'lesson' ? 1 : 0),
    weekIndex: week,
    weekPoints: (old.weekIndex === week ? old.weekPoints : 0) + delta,
  };
}

/** Текущая серия для показа: если вчера и сегодня не занимались, серия прервалась. */
export function currentStreak(stats, nowMs) {
  if (!stats) return 0;
  const today = dayIndex(nowMs);
  return stats.lastActiveDay >= today - 1 ? (stats.streak ?? 0) : 0;
}

/** Сегодняшние счётчики (вчерашние не считаются). */
export function todayCounters(stats, nowMs) {
  const same = stats?.dayIndex === dayIndex(nowMs);
  return {
    tasks: same ? (stats.dayTasks ?? 0) : 0,
    reviews: same ? (stats.dayReviews ?? 0) : 0,
    lessons: same ? (stats.dayLessons ?? 0) : 0,
  };
}

/** Очки этой недели (прошлые недели не считаются). */
export function currentWeekPoints(stats, nowMs) {
  return stats?.weekIndex === weekIndex(dayIndex(nowMs)) ? (stats.weekPoints ?? 0) : 0;
}

const QUEST_POOL = Object.freeze([
  { id: 'tasks3', counter: 'tasks', goal: 3, title: 'Решите 3 задания' },
  { id: 'tasks5', counter: 'tasks', goal: 5, title: 'Решите 5 заданий' },
  { id: 'reviews5', counter: 'reviews', goal: 5, title: 'Повторите 5 слов' },
  { id: 'reviews10', counter: 'reviews', goal: 10, title: 'Повторите 10 слов' },
  { id: 'lesson1', counter: 'lessons', goal: 1, title: 'Пройдите урок' },
]);

/**
 * Ежедневные задания: три на день (UTC), одинаковые для всех. Набор
 * зависит от номера дня: одно на задания, одно на повторение, третье — по кругу.
 */
export function dailyQuests(day) {
  const tasks = QUEST_POOL.filter((q) => q.counter === 'tasks');
  const reviews = QUEST_POOL.filter((q) => q.counter === 'reviews');
  const lesson = QUEST_POOL.find((q) => q.counter === 'lessons');
  const odd = day % 2;
  const third = [lesson, tasks[1 - odd], reviews[odd]][day % 3];
  return [tasks[odd], reviews[1 - odd], third].map((q) => ({ ...q }));
}

/** Задания дня с прогрессом: [{ id, title, goal, progress, done }]. */
export function questProgress(stats, nowMs) {
  const counters = todayCounters(stats, nowMs);
  return dailyQuests(dayIndex(nowMs)).map((q) => {
    const progress = Math.min(q.goal, counters[q.counter]);
    return { ...q, progress, done: progress >= q.goal };
  });
}
