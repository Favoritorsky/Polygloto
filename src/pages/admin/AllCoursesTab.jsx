import { useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useSubscription } from '../../hooks/useSubscription.js';
import { deleteCourse } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { subscribeToAllCourses } from '../../services/moderationService.js';
import styles from './AdminList.module.css';

/** Все курсы (последние 100): админ может открыть в редакторе или удалить любой. */
export default function AllCoursesTab() {
  const { data, loading, error, retry } = useSubscription(subscribeToAllCourses, 'all');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(null);

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
          <li key={course.id} className={styles.item}>
            <div className={styles.main}>
              <Link to={`/courses/${course.id}/edit`} className={styles.title}>
                {course.title}
              </Link>
              <div className={styles.meta}>
                <span>{course.language}</span>
                <Link to={`/users/${course.authorId}`}>Автор</Link>
                {course.hasPublishedVersion && <Link to={`/course/${course.id}`}>Опубликованная версия</Link>}
              </div>
            </div>
            <StatusBadge status={course.status} />
            <Button variant="danger" size="sm" loading={deleting === course.id} onClick={() => handleDelete(course)}>
              Удалить
            </Button>
          </li>
        ))}
      </ul>
    </AsyncState>
  );
}
