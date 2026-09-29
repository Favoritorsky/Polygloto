import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CategoryLegend from '../../components/content/CategoryLegend.jsx';
import RatingButtons from '../../components/course/RatingButtons.jsx';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToDictionary } from '../../services/dictionaryService.js';
import { subscribeToPublicCourse } from '../../services/publicCourseService.js';
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

  const { data: course, loading, error, retry } = useSubscription(
    (onData, onError) => subscribeToPublicCourse(courseId, onData, onError),
    courseId,
  );
  const dictionarySub = useSubscription(
    (onData, onError) => subscribeToDictionary(courseId, { published: true }, onData, onError),
    course ? courseId : null,
  );
  const entries = dictionarySub.data;
  const value = useMemo(
    () =>
      course && {
        course,
        dictionary: {
          entries,
          index: buildDictionaryIndex(entries ?? []),
          loading: dictionarySub.loading,
          error: dictionarySub.error,
          retry: dictionarySub.retry,
        },
      },
    [course, entries, dictionarySub.loading, dictionarySub.error, dictionarySub.retry],
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
            <article className={styles.page}>
              <header className={styles.header}>
                <div className={styles.info}>
                  <p className={styles.language}>{course.language}</p>
                  <h1 className={styles.title}>{course.title}</h1>
                  <p className={styles.author}>
                    Автор: <Link to={`/users/${course.authorId}`}>{course.authorName || 'Без имени'}</Link>
                  </p>
                  {course.description && <p className={styles.description}>{course.description}</p>}
                  <ul className={styles.stats}>
                    <li>Уроков: {course.lessonsCount ?? 0}</li>
                    <li>Слов в словаре: {course.wordsCount ?? 0}</li>
                  </ul>
                </div>
                <RatingButtons course={course} />
              </header>

              {course.categories?.length > 0 && <CategoryLegend categories={course.categories} />}

              <Tabs tabs={TABS} active={tab} onChange={changeTab} label="Разделы курса" />
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
                    <DictionaryBrowser entries={entries ?? []} />
                  </AsyncState>
                )}
                {tab === 'comments' && <CommentsSection />}
              </div>
            </article>
          </CoursePageContext.Provider>
        )
      )}
    </AsyncState>
  );
}
