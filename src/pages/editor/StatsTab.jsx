import { useMemo } from 'react';
import AsyncState from '../../components/ui/AsyncState.jsx';
import { useAsync } from '../../hooks/useSubscription.js';
import { STATS_MIN_ATTEMPTS, loadCourseTaskStats } from '../../services/taskStatsService.js';
import { getTaskType } from '../../tasks/taskTypeRegistry.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './StatsTab.module.css';

/** Короткое описание задания для таблицы статистики. */
function taskSummary(data) {
  const text =
    data.question || data.instruction || data.source || [data.before, '…', data.after].filter(Boolean).join(' ') || data.answers?.[0] || '';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

/**
 * Статистика заданий опубликованной версии: сколько читателей ответили и
 * какая доля ошиблась с первой попытки. Только суммы, без имён; процент —
 * от STATS_MIN_ATTEMPTS ответов, чтобы по нему нельзя было узнать ответ одного человека.
 */
export default function StatsTab() {
  const { course, courseId } = useCourseEditor();
  const published = course.hasPublishedVersion;
  const stats = useAsync(() => loadCourseTaskStats(courseId), published ? courseId : null);
  const hardest = useMemo(() => {
    const all = (stats.data ?? []).flatMap((l) => l.tasks.map((t) => ({ ...t, lesson: l.title })));
    return all
      .filter((t) => t.attempts >= STATS_MIN_ATTEMPTS)
      .sort((a, b) => b.wrong / b.attempts - a.wrong / a.attempts)
      .slice(0, 3)
      .filter((t) => t.wrong > 0);
  }, [stats.data]);

  if (!published)
    return <p className={styles.muted}>Статистика появится, когда курс будет опубликован и читатели начнут решать задания.</p>;

  return (
    <AsyncState
      loading={stats.loading}
      error={stats.error}
      onRetry={stats.retry}
      empty={stats.data?.length === 0}
      emptyText="В опубликованных уроках нет заданий."
    >
      <p className={styles.muted}>
        Считается только первая попытка каждого читателя в опубликованной версии. Процент ошибок показывается, когда ответов не меньше{' '}
        {STATS_MIN_ATTEMPTS}. Кто именно ответил, не хранится.
      </p>
      {hardest.length > 0 && (
        <section className={styles.hardest} aria-label="Самые трудные задания">
          <h3>Самые трудные задания</h3>
          <ol>
            {hardest.map((t) => (
              <li key={`${t.lesson}-${t.id}`}>
                {Math.round((t.wrong / t.attempts) * 100)}% ошибок — {t.lesson}: {taskSummary(t.data) || getTaskType(t.taskType)?.label}
              </li>
            ))}
          </ol>
        </section>
      )}
      {(stats.data ?? []).map((lesson) => (
        <section key={lesson.lessonId} className={styles.lesson}>
          <h3>{lesson.title || 'Без названия'}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Задание</th>
                <th scope="col">Ответили</th>
                <th scope="col">Ошибок с первой попытки</th>
              </tr>
            </thead>
            <tbody>
              {lesson.tasks.map((t) => {
                const enough = t.attempts >= STATS_MIN_ATTEMPTS;
                const percent = enough ? Math.round((t.wrong / t.attempts) * 100) : null;
                return (
                  <tr key={t.id}>
                    <td>
                      <span className={styles.kind}>{getTaskType(t.taskType)?.label ?? t.taskType}</span>
                      {taskSummary(t.data)}
                    </td>
                    <td>{t.attempts}</td>
                    <td>
                      {enough ? (
                        <span className={styles.bar} style={{ '--percent': `${percent}%` }}>
                          {percent}%
                        </span>
                      ) : (
                        <span className={styles.muted}>мало ответов</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </AsyncState>
  );
}
