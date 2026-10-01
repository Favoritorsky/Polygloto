import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CardLink from '../../components/ui/CardLink.jsx';
import CreateCourseForm from '../../components/course/CreateCourseForm.jsx';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToMyCourses } from '../../services/courseService.js';
import { importCourse, readImportFile } from '../../services/courseTransferService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './MyCoursesPage.module.css';

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleDateString('ru-RU') : '—';
}

export default function MyCoursesPage() {
  const { user, isBanned } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  const [importState, setImportState] = useState(null); // { progress } | { error } | { courseId, warnings }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportState({ progress: 'Читаю файл…' });
    let createdId = null;
    try {
      const data = await readImportFile(file);
      createdId = await importCourse(user.uid, data, (progress) => setImportState({ progress }));
      if (data.warnings.length === 0) navigate(`/courses/${createdId}/edit`);
      else setImportState({ courseId: createdId, warnings: data.warnings });
    } catch (err) {
      setImportState({ error: toUserMessage(err), courseId: createdId });
    }
  }
  const {
    data: courses,
    loading,
    error,
    retry,
  } = useSubscription((onData, onError) => subscribeToMyCourses(user.uid, onData, onError), user.uid);

  return (
    <div>
      <div className={styles.header}>
        <h1>Мои курсы</h1>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={isBanned || Boolean(importState?.progress)}>
            Импорт из JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={handleImport} aria-label="Файл курса" />
          <Button onClick={() => setCreating(true)} disabled={isBanned}>
            + Новый курс
          </Button>
        </div>
      </div>
      {importState?.progress && (
        <Alert tone="info" title="Импорт курса">
          {importState.progress}
        </Alert>
      )}
      {importState?.error && (
        <Alert tone="error" title="Импорт не удался">
          {importState.error}
          {importState.courseId && (
            <>
              {' '}
              Черновик уже создан: <Link to={`/courses/${importState.courseId}/edit`}>открыть</Link> или удалить в настройках.
            </>
          )}
        </Alert>
      )}
      {importState?.warnings && (
        <Alert tone="warning" title="Курс импортирован с замечаниями">
          <ul>
            {importState.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <Link to={`/courses/${importState.courseId}/edit`}>Открыть курс</Link>
        </Alert>
      )}
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
                <CardLink to={`/courses/${course.id}/edit`} className={styles.title}>
                  {course.title}
                </CardLink>
                <div className={styles.meta}>
                  <span>{course.language}</span>
                  <span>Изменён {formatDate(course.updatedAt)}</span>
                  {course.hasPublishedVersion && course.status !== 'published' && <span>Опубликованная версия доступна читателям</span>}
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
