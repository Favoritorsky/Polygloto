import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import CardLink from '../../components/ui/CardLink.jsx';
import tile from '../../components/ui/CardLink.module.css';
import { useSubscription } from '../../hooks/useSubscription.js';
import { deleteCourse } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { subscribeToAllCourses, withdrawCourse } from '../../services/moderationService.js';
import styles from './AdminList.module.css';

/** Все курсы (последние 100): админ может открыть в редакторе, отозвать опубликованный или удалить любой. */
export default function AllCoursesTab() {
  const { data, loading, error, retry } = useSubscription(subscribeToAllCourses, 'all');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);

  async function handleWithdraw(course) {
    const question =
      `Отозвать курс «${course.title}» из общего доступа?\n\n` +
      'Он пропадёт из каталога, но не удалится: у автора останется в черновиках, ' +
      'и его можно будет снова отправить на проверку. Комментарии и оценки сохранятся.';
    if (!window.confirm(question)) return;
    setWithdrawing(course.id);
    setActionError('');
    try {
      await withdrawCourse(course.id);
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setWithdrawing(null);
    }
  }

  async function handleDelete(course) {
    if (!window.confirm(`Удалить курс «${course.title}» со всеми уроками, комментариями и оценками?`)) return;
    setDeleting(course.id);
    setActionError('');
    try {
      await deleteCourse(course.id);
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={retry} empty={data?.length === 0} emptyText="Курсов пока нет.">
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <ul className={styles.list}>
        {data?.map((course) => (
          <li key={course.id} className={`${styles.item} ${tile.tile}`}>
            <div className={styles.main}>
              <CardLink to={`/courses/${course.id}/edit`} className={styles.title}>
                {course.title}
              </CardLink>
              <div className={styles.meta}>
                <span>{course.language}</span>
                <Link to={`/users/${course.authorId}`} className={tile.above}>
                  Автор
                </Link>
                {course.hasPublishedVersion && (
                  <Link to={`/course/${course.id}`} className={tile.above}>
                    Опубликованная версия
                  </Link>
                )}
              </div>
            </div>
            <StatusBadge status={course.status} />
            {course.hasPublishedVersion && (
              <Button
                className={tile.above}
                variant="secondary"
                size="sm"
                loading={withdrawing === course.id}
                title="Убрать из общего доступа — у автора курс останется черновиком"
                onClick={() => handleWithdraw(course)}
              >
                Отозвать
              </Button>
            )}
            <Button className={tile.above} variant="danger" size="sm" loading={deleting === course.id} onClick={() => handleDelete(course)}>
              Удалить
            </Button>
          </li>
        ))}
      </ul>
    </AsyncState>
  );
}
