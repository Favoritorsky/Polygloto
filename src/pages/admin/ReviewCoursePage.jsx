import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COURSE_STATUS, LIMITS } from '../../../shared/schema.js';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { sortByOrder } from '../../model/courseStatus.js';
import { subscribeToCourse } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { approveCourse, loadCourseContent, rejectCourse } from '../../services/moderationService.js';
import styles from './ReviewCoursePage.module.css';

const TABS = [
  { id: 'lessons', label: 'Самоучитель' },
  { id: 'reference', label: 'Справочник' },
  { id: 'dictionary', label: 'Словарь' },
];

function Sections({ sections, course, dictionary, emptyText }) {
  if (!sections.length) return <p className={styles.muted}>{emptyText}</p>;
  return sections.map((section, i) => (
    <article key={section.id} className={styles.section}>
      <h2>
        {i + 1}. {section.title || 'Без названия'}
      </h2>
      <ContentRenderer blocks={section.blocks} categories={course.categories} dictionary={dictionary} courseId={course.id} />
    </article>
  ));
}

/** Просмотр курса на модерации и решение: одобрить / отклонить с причиной. */
export default function ReviewCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('lessons');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const courseSub = useSubscription((onData, onError) => subscribeToCourse(courseId, onData, onError), courseId);
  const course = courseSub.data;
  const content = useAsync(() => loadCourseContent(courseId), course ? `${courseId}:${course.submittedAt?.toMillis?.()}` : null);
  const dictionary = useMemo(() => buildDictionaryIndex(content.data?.dictionary ?? []), [content.data]);

  async function decide(kind) {
    if (busy) return;
    setError('');
    if (kind === 'reject' && reason.trim().length < LIMITS.REJECTION_REASON_MIN) {
      setError(`Укажите причину отклонения (минимум ${LIMITS.REJECTION_REASON_MIN} символов) — автор увидит её.`);
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'approve') await approveCourse(courseId);
      else await rejectCourse(courseId, reason.trim());
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setBusy(null);
    }
  }

  return (
    <AsyncState loading={courseSub.loading} error={courseSub.error} onRetry={courseSub.retry} empty={course === null} emptyText="Курс не найден.">
      {course && (
        <div>
          <Link to="/admin" className={styles.back}>
            ← К очереди
          </Link>
          <header className={styles.header}>
            <div>
              <h1>{course.title}</h1>
              <div className={styles.meta}>
                <StatusBadge status={course.status} />
                <span>{course.language}</span>
                <Link to={`/users/${course.authorId}`}>Профиль автора</Link>
                {course.hasPublishedVersion && <Link to={`/course/${course.id}`}>Текущая опубликованная версия</Link>}
              </div>
              {course.description && <p className={styles.description}>{course.description}</p>}
            </div>
          </header>

          {course.status !== COURSE_STATUS.PENDING_REVIEW ? (
            <Alert tone="info">Курс сейчас не на проверке — решение принять нельзя.</Alert>
          ) : (
            <section className={styles.decision}>
              {error && <Alert tone="error">{error}</Alert>}
              {rejecting ? (
                <>
                  <Field label="Причина отклонения" hint="Автор увидит этот текст и сможет исправить курс.">
                    {(p) => <textarea {...p} rows={3} maxLength={LIMITS.REJECTION_REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />}
                  </Field>
                  <div className={styles.buttons}>
                    <Button variant="secondary" onClick={() => setRejecting(false)} disabled={Boolean(busy)}>
                      Отмена
                    </Button>
                    <Button variant="danger" onClick={() => decide('reject')} loading={busy === 'reject'}>
                      Отклонить
                    </Button>
                  </div>
                </>
              ) : (
                <div className={styles.buttons}>
                  <Button onClick={() => decide('approve')} loading={busy === 'approve'} disabled={!content.data}>
                    Одобрить и опубликовать
                  </Button>
                  <Button variant="secondary" onClick={() => setRejecting(true)} disabled={Boolean(busy)}>
                    Отклонить…
                  </Button>
                </div>
              )}
            </section>
          )}

          <Tabs tabs={TABS} active={tab} onChange={setTab} label="Содержимое курса" />
          <AsyncState loading={content.loading} error={content.error} onRetry={content.retry}>
            {content.data && tab === 'lessons' && (
              <Sections sections={sortByOrder(content.data.lessons, course.lessonOrder)} course={course} dictionary={dictionary} emptyText="Уроков нет." />
            )}
            {content.data && tab === 'reference' && (
              <Sections sections={sortByOrder(content.data.reference, course.referenceOrder)} course={course} dictionary={dictionary} emptyText="Справочник пуст." />
            )}
            {content.data && tab === 'dictionary' && <DictionaryBrowser entries={content.data.dictionary} />}
          </AsyncState>
        </div>
      )}
    </AsyncState>
  );
}
