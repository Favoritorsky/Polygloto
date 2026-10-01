import { Link } from 'react-router-dom';
import { POINTS, currentStreak, currentWeekPoints, questProgress } from '../../../shared/gamification.js';
import AsyncState from '../../components/ui/AsyncState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useNow, useUserStats } from '../../hooks/useMyStats.js';
import { plural } from '../../model/plural.js';
import styles from './ProgressPage.module.css';

/** «Мой прогресс»: серия дней, очки, задания дня (сутки — по UTC). */
export default function ProgressPage() {
  const { user } = useAuth();
  const stats = useUserStats(user.uid);
  const now = useNow(60000);
  const streak = currentStreak(stats.data, now);
  const quests = questProgress(stats.data, now);
  const doneCount = quests.filter((q) => q.done).length;
  const resetHour = new Date(Date.UTC(2000, 0, 1)).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={styles.page}>
      <h1>Мой прогресс</h1>
      <AsyncState loading={stats.loading} error={stats.error} onRetry={stats.retry}>
        <section className={styles.cards} aria-label="Итоги">
          <div className={styles.card}>
            <span className={styles.big}>🔥 {streak}</span>
            <span>{plural(streak, ['день подряд', 'дня подряд', 'дней подряд'])}</span>
            <small>Рекорд: {stats.data?.bestStreak ?? 0}</small>
          </div>
          <div className={styles.card}>
            <span className={styles.big}>{currentWeekPoints(stats.data, now)}</span>
            <span>{plural(currentWeekPoints(stats.data, now), ['очко', 'очка', 'очков'])} за неделю</span>
            <small>Всего: {stats.data?.points ?? 0}</small>
          </div>
          <div className={styles.card}>
            <span className={styles.big}>{stats.data?.tasksCount ?? 0}</span>
            <span>{plural(stats.data?.tasksCount ?? 0, ['задание', 'задания', 'заданий'])} решено</span>
            <small>Слов вспомнено: {stats.data?.reviewsCount ?? 0}</small>
          </div>
        </section>

        <section className={styles.quests} aria-label="Задания дня">
          <h2>
            Задания дня <small>{doneCount === quests.length ? '— все выполнены! 🎉' : `— ${doneCount} из ${quests.length}`}</small>
          </h2>
          <ul>
            {quests.map((q) => (
              <li key={q.id} className={q.done ? styles.done : undefined}>
                <span className={styles.check} aria-hidden="true">
                  {q.done ? '✓' : '○'}
                </span>
                <span className={styles.questTitle}>{q.title}</span>
                <progress max={q.goal} value={q.progress} aria-label={`${q.title}: ${q.progress} из ${q.goal}`} />
                <span className={styles.count}>
                  {q.progress}/{q.goal}
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.muted}>
            Новые задания каждый день в {resetHour} по вашему времени (полночь по UTC). Серия считается так же.
          </p>
        </section>

        <section className={styles.rules}>
          <h2>Как начисляются очки</h2>
          <ul>
            <li>
              Задание с первой попытки: {POINTS.TASK_CORRECT} за верный ответ, {POINTS.TASK_WRONG} — за неверный. Повторные попытки очков не
              дают.
            </li>
            <li>Урок пройден впервые: {POINTS.LESSON}.</li>
            <li>
              Слово вспомнено в <Link to="/review">повторении</Link>: {POINTS.REVIEW} (кроме самого первого повторения новой карточки).
            </li>
            <li>Серия растёт, если за сутки решено хотя бы одно задание или повторено хотя бы одно слово.</li>
          </ul>
          <p>
            <Link to="/leaderboard">Рейтинг недели →</Link>
          </p>
        </section>
      </AsyncState>
    </div>
  );
}
