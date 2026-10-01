import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COURSE_STATUS } from '../../../shared/schema.js';
import StatusBadge from '../../components/course/StatusBadge.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import AudioSourceProvider from '../../audio/AudioSourceProvider.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { returnToDraft, subscribeToCourse } from '../../services/courseService.js';
import { subscribeToDictionary } from '../../services/dictionaryService.js';
import { toUserMessage } from '../../services/errors.js';
import { CourseEditorContext } from './courseEditorContext.js';
import DictionaryTab from './DictionaryTab.jsx';
import SectionsTab from './SectionsTab.jsx';
import SettingsTab from './SettingsTab.jsx';
import StatsTab from './StatsTab.jsx';
import StatusPanel from './StatusPanel.jsx';
import styles from './CourseEditorPage.module.css';

const TABS = [
  { id: 'lessons', label: 'Самоучитель' },
  { id: 'reference', label: 'Справочник' },
  { id: 'dictionary', label: 'Словарь' },
  { id: 'stats', label: 'Статистика' },
  { id: 'settings', label: 'Настройки курса' },
];

export default function CourseEditorPage() {
  const { courseId } = useParams();
  const { isBanned, isAdmin, user } = useAuth();
  const [tab, setTab] = useState('lessons');
  const [withdrawing, setWithdrawing] = useState(false);
  const [actionError, setActionError] = useState('');
  const {
    data: course,
    loading,
    error,
    retry,
  } = useSubscription((onData, onError) => subscribeToCourse(courseId, onData, onError), courseId);

  // Словарь нужен сразу нескольким вкладкам (вкладка словаря, ссылки в уроках, предпросмотр).
  const dictionarySub = useSubscription(
    (onData, onError) => subscribeToDictionary(courseId, { published: false }, onData, onError),
    course ? courseId : null,
  );
  const dictionaryEntries = dictionarySub.data;
  const dictionary = useMemo(
    () => ({
      entries: dictionaryEntries,
      index: buildDictionaryIndex(dictionaryEntries ?? []),
      loading: dictionarySub.loading,
      error: dictionarySub.error,
      retry: dictionarySub.retry,
    }),
    [dictionaryEntries, dictionarySub.loading, dictionarySub.error, dictionarySub.retry],
  );

  // Актуальный статус для ensureDraft (подписка обновляет его асинхронно).
  const statusRef = useRef(null);
  const courseStatus = course?.status ?? null;
  useEffect(() => {
    statusRef.current = courseStatus;
  }, [courseStatus]);
  const draftPromise = useRef(null);

  const ensureDraft = useCallback(async () => {
    const status = statusRef.current;
    if (status === COURSE_STATUS.DRAFT) return;
    if (status === COURSE_STATUS.PENDING_REVIEW) {
      throw Object.assign(new Error('Курс на проверке'), {
        userMessage: 'Курс на проверке: отзовите его, чтобы править.',
      });
    }
    // Одна смена статуса на несколько одновременных сохранений.
    if (!draftPromise.current) {
      draftPromise.current = returnToDraft(courseId)
        .then(() => {
          statusRef.current = COURSE_STATUS.DRAFT;
        })
        .finally(() => {
          draftPromise.current = null;
        });
    }
    await draftPromise.current;
  }, [courseId]);

  // Реестр автосохранений открытых редакторов: перед отправкой на проверку
  // все несохранённые правки дописываются (в pending_review контент заморожен).
  const autosaves = useRef(new Set());
  const registerAutosave = useCallback((entry) => {
    autosaves.current.add(entry);
    return () => autosaves.current.delete(entry);
  }, []);
  const flushAll = useCallback(async () => {
    const entries = [...autosaves.current];
    await Promise.all(entries.map((e) => e.flush()));
    return entries.every((e) => !e.hasPending());
  }, []);

  const readOnly = isBanned || course?.status === COURSE_STATUS.PENDING_REVIEW;
  // Соавтор (v2) правит как автор, но не удаляет курс и не меняет соавторов.
  const isAuthor = Boolean(course && (course.authorId === user?.uid || isAdmin));
  const contextValue = useMemo(
    () =>
      course
        ? {
            course,
            courseId,
            readOnly,
            isAuthor,
            ensureDraft,
            dictionary,
            registerAutosave,
            flushAll,
          }
        : null,
    [course, courseId, readOnly, isAuthor, ensureDraft, dictionary, registerAutosave, flushAll],
  );

  async function handleWithdraw() {
    setWithdrawing(true);
    setActionError('');
    try {
      await returnToDraft(courseId);
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setWithdrawing(false);
    }
  }

  const notFound = !loading && !error && course === null;
  const denied = error?.code === 'permission-denied';

  return (
    <AsyncState loading={loading} error={denied || notFound ? null : error} onRetry={retry}>
      {denied || notFound ? (
        <Alert tone="error" title="Курс недоступен">
          Курс не найден или у вас нет прав на его редактирование. <Link to="/my-courses">К моим курсам</Link>
        </Alert>
      ) : (
        course && (
          <CourseEditorContext.Provider value={contextValue}>
            <AudioSourceProvider courseId={courseId} uid={user?.uid}>
              <div className={styles.header}>
                <div>
                  <Link to="/my-courses" className={styles.back}>
                    ← Мои курсы
                  </Link>
                  <h1 className={styles.title}>{course.title}</h1>
                  <div className={styles.meta}>
                    <StatusBadge status={course.status} />
                    <span>{course.language}</span>
                    {!isAuthor && <span>Вы соавтор</span>}
                  </div>
                </div>
              </div>

              <StatusPanel />
              {course.status === COURSE_STATUS.PENDING_REVIEW && (
                <Alert
                  tone="warning"
                  title="Курс на проверке"
                  action={
                    <Button size="sm" variant="secondary" onClick={handleWithdraw} loading={withdrawing}>
                      Отозвать и редактировать
                    </Button>
                  }
                >
                  Пока идёт модерация, правки недоступны — так администратор проверяет именно ту версию, которую вы отправили.
                </Alert>
              )}
              {actionError && <Alert tone="error">{actionError}</Alert>}

              <Tabs tabs={TABS} active={tab} onChange={setTab} label="Разделы курса" />
              {tab === 'lessons' && <SectionsTab kind="lessons" key="lessons" />}
              {tab === 'reference' && <SectionsTab kind="reference" key="reference" />}
              {tab === 'dictionary' && <DictionaryTab />}
              {tab === 'stats' && <StatsTab />}
              {tab === 'settings' && <SettingsTab />}
            </AudioSourceProvider>
          </CourseEditorContext.Provider>
        )
      )}
    </AsyncState>
  );
}
