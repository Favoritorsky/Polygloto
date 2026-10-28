import AudioSourceProvider from '../../audio/AudioSourceProvider.jsx';
import CoAuthorsLine from '../../components/course/CoAuthorsLine.jsx';
import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import RatingButtons from '../../components/course/RatingButtons.jsx';
import { chatPath } from '../../../shared/chat.js';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToDictionary } from '../../services/dictionaryService.js';
import { subscribeToPublicCourse } from '../../services/publicCourseService.js';
import { addWordsToReview, subscribeToCourseCards } from '../../services/srsService.js';
import ReviewButton from '../../components/review/ReviewButton.jsx';
import { downloadJson, exportPublicCourse } from '../../services/courseTransferService.js';
import { toUserMessage } from '../../services/errors.js';
import CommentsSection from './CommentsSection.jsx';
import { CoursePageContext } from './coursePageContext.js';
import SectionReader from './SectionReader.jsx';
import styles from './CoursePage.module.css';

const TABS = [
  { id: 'lessons', label: 'Самоучитель' },
  { id: 'reference', label: 'Справочник' },
  { id: 'dictionary', label: 'Словарь' },
  { id: 'comments', label: 'Обсуждение' },
];
const TAB_IDS = TABS.map((t) => t.id);

/** Публичная страница опубликованного курса (снимок publicCourses/{id}). */
export default function CoursePage() {
  const { courseId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get('tab')) ? params.get('tab') : 'lessons';

  const {
    data: course,
    loading,
    error,
    retry,
  } = useSubscription((onData, onError) => subscribeToPublicCourse(courseId, onData, onError), courseId);
  const dictionarySub = useSubscription(
    (onData, onError) => subscribeToDictionary(courseId, { published: true }, onData, onError),
    course ? courseId : null,
  );
  const entries = dictionarySub.data;

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  async function handleDownload() {
    setDownloading(true);
    setDownloadError('');
    try {
      const { fileName, json } = await exportPublicCourse(courseId, course, entries);
      downloadJson(fileName, json);
    } catch (err) {
      setDownloadError(toUserMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  // Повторение: какие слова курса уже у читателя в карточках.
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const cardsSub = useSubscription(
    (onData, onError) => subscribeToCourseCards(uid, courseId, onData, onError),
    uid && course ? `${uid}/${courseId}` : null,
  );
  const [adding, setAdding] = useState(() => new Set());
  const addToReview = useCallback(
    async (entry) => {
      setAdding((s) => new Set(s).add(entry.id));
      try {
        await addWordsToReview(uid, courseId, [entry]);
      } finally {
        setAdding((s) => {
          const next = new Set(s);
          next.delete(entry.id);
          return next;
        });
      }
    },
    [uid, courseId],
  );
  const review = useMemo(
    () => (uid ? { wordIds: cardsSub.data ?? new Set(), adding, add: addToReview } : null),
    [uid, cardsSub.data, adding, addToReview],
  );

  const value = useMemo(
    () =>
      course && {
        course,
        review,
        dictionary: {
          entries,
          index: buildDictionaryIndex(entries ?? []),
          loading: dictionarySub.loading,
          error: dictionarySub.error,
          retry: dictionarySub.retry,
        },
      },
    [course, review, entries, dictionarySub.loading, dictionarySub.error, dictionarySub.retry],
  );

  function changeTab(id) {
    // Переход на другую вкладку сбрасывает выбранный урок/раздел.
    setParams(id === 'lessons' ? {} : { tab: id });
  }

  return (
    <AsyncState loading={loading} error={error} onRetry={retry} loadingLabel="Загружаем курс…">
      {course === null ? (
        <div className={styles.missing}>
          <h1>Курс не найден</h1>
          <p>Курс не найден или ещё не опубликован.</p>
          <Link to="/catalog">Перейти в каталог</Link>
        </div>
      ) : (
        value && (
          <CoursePageContext.Provider value={value}>
            <AudioSourceProvider courseId={courseId} published>
              <article className={styles.page}>
                <header className={styles.header}>
                  <div className={styles.info}>
                    <p className={styles.language}>{course.language}</p>
                    <h1 className={styles.title}>{course.title}</h1>
                    <p className={styles.author}>
                      Автор: <Link to={`/users/${course.authorId}`}>{course.authorName || 'Без имени'}</Link>
                    </p>
                    <CoAuthorsLine uids={course.coAuthors} className={styles.author} />
                    {course.description && <p className={styles.description}>{course.description}</p>}
                    <ul className={styles.stats}>
                      <li>Уроков: {course.lessonsCount ?? 0}</li>
                      <li>Слов в словаре: {course.wordsCount ?? 0}</li>
                    </ul>
                    <div className={styles.links}>
                      {course.languageLower && (
                        <Link to={chatPath(course.languageLower, courseId)} className={styles.games}>
                          💬 Чат языка «{course.language}»
                        </Link>
                      )}
                      {(course.wordsCount ?? 0) >= 4 && (
                        <Link to={`/course/${courseId}/games`} className={styles.games}>
                          🎮 Мини-игры по словарю
                        </Link>
                      )}
                      {course.allowDownload && (
                        <button
                          type="button"
                          className={`${styles.games} ${styles.linkButton}`}
                          onClick={handleDownload}
                          disabled={downloading || !entries}
                        >
                          {downloading ? '⏳ Собираю файл…' : '⬇ Скачать курс (JSON)'}
                        </button>
                      )}
                    </div>
                    {downloadError && <p className={styles.downloadError}>{downloadError}</p>}
                  </div>
                  <RatingButtons course={course} />
                </header>

                <Tabs tabs={TABS} active={tab} onChange={changeTab} label="Разделы курса" sticky />
                <div className={styles.body}>
                  {tab === 'lessons' && <SectionReader key="lessons" kind="lessons" />}
                  {tab === 'reference' && <SectionReader key="reference" kind="reference" />}
                  {tab === 'dictionary' && (
                    <AsyncState
                      loading={dictionarySub.loading}
                      error={dictionarySub.error}
                      onRetry={dictionarySub.retry}
                      empty={entries?.length === 0}
                      emptyText="Словарь курса пока пуст."
                    >
                      <DictionaryBrowser
                        entries={entries ?? []}
                        renderActions={review ? (entry) => <ReviewButton entry={entry} review={review} /> : undefined}
                      />
                    </AsyncState>
                  )}
                  {tab === 'comments' && <CommentsSection />}
                </div>
              </article>
            </AudioSourceProvider>
          </CoursePageContext.Provider>
        )
      )}
    </AsyncState>
  );
}
