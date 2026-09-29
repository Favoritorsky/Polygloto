import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CreateCourseForm from '../../components/course/CreateCourseForm.jsx';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToMyCourses } from '../../services/courseService.js';
import styles from './MyCoursesPage.module.css';

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('ru-RU') : '—';
}

export default function MyCoursesPage() {
  const { user, isBanned } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data: courses, loading, error, retry } = useSubscription(
    (onData, onError) => subscribeToMyCourses(user.uid, onData, onError),
    user.uid,
  );

  return (
    <div>
      <div className={styles.header}>
        <h1>Мои курсы</h1>
        <Button onClick={() => setCreating(true)} disabled={isBanned}>
          + Новый курс
        </Button>
      </div>
      {isBanned && <Alert tone="error">Аккаунт заблокирован: создание и редактирование курсов недоступно.</Alert>}

      <AsyncState
        loading={loading}
        error={error}
        onRetry={retry}
        empty={courses?.length === 0}
        emptyText="У вас пока нет курсов. Создайте первый — черновик можно писать сразу, без подтверждения почты."
      >
        <ul className={styles.list}>
          {courses?.map((course) => (
            <li key={course.id} className={styles.item}>
              <div className={styles.main}>
                <Link to={`/courses/${course.id}/edit`} className={styles.title}>
                  {course.title}
                </Link>
                <div className={styles.meta}>
                  <span>{course.language}</span>
                  <span>Изменён {formatDate(course.updatedAt)}</span>
                  {course.hasPublishedVersion && course.status !== 'published' && (
                    <span>Опубликованная версия доступна читателям</span>
                  )}
                </div>
              </div>
              <StatusBadge status={course.status} />
              {course.hasPublishedVersion && (
                <Link to={`/course/${course.id}`} className={styles.viewLink}>
                  Открыть
                </Link>
              )}
            </li>
          ))}
        </ul>
      </AsyncState>

      <Modal open={creating} title="Новый курс" onClose={() => setCreating(false)}>
        <CreateCourseForm
          onCancel={() => setCreating(false)}
          onCreated={(courseId) => {
            setCreating(false);
            navigate(`/courses/${courseId}/edit`);
          }}
        />
      </Modal>
    </div>
  );
}
