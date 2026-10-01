import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { GAME_LIMITS, playableWords } from '../../games/gameLogic.js';
import MemoryGame from '../../games/MemoryGame.jsx';
import SpeedGame from '../../games/SpeedGame.jsx';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToDictionary } from '../../services/dictionaryService.js';
import { subscribeToPublicCourse } from '../../services/publicCourseService.js';
import styles from './GamesPage.module.css';

const TABS = [
  { id: 'memory', label: 'Найди пары' },
  { id: 'speed', label: 'На скорость' },
];

/** Мини-игры по словарю опубликованного курса. Доступны и без входа. */
export default function GamesPage() {
  const { courseId } = useParams();
  const [tab, setTab] = useState('memory');
  const course = useSubscription((onData, onError) => subscribeToPublicCourse(courseId, onData, onError), courseId);
  const dictionary = useSubscription((onData, onError) => subscribeToDictionary(courseId, { published: true }, onData, onError), courseId);
  const words = useMemo(() => playableWords(dictionary.data ?? []), [dictionary.data]);
  const enough = words.length >= GAME_LIMITS.MIN_WORDS;

  return (
    <div className={styles.page}>
      <AsyncState
        loading={course.loading || dictionary.loading}
        error={course.error || dictionary.error}
        onRetry={() => {
          course.retry();
          dictionary.retry();
        }}
        empty={course.data === null}
        emptyText="Курс не найден или ещё не опубликован."
      >
        {course.data && (
          <>
            <Link to={`/course/${courseId}`} className={styles.back}>
              ← {course.data.title}
            </Link>
            <h1>Мини-игры</h1>
            {!enough ? (
              <p className={styles.muted}>
                Для игр нужно хотя бы {GAME_LIMITS.MIN_WORDS} слова с разными переводами в словаре курса, а подходящих слов сейчас {words.length}.
              </p>
            ) : (
              <>
                <p className={styles.muted}>Слова — из словаря курса ({words.length}). Лучший результат запоминается в этом браузере.</p>
                <Tabs tabs={TABS} active={tab} onChange={setTab} label="Игры" />
                {tab === 'memory' ? (
                  <MemoryGame key="memory" courseId={courseId} entries={words} />
                ) : (
                  <SpeedGame key="speed" courseId={courseId} entries={words} />
                )}
              </>
            )}
          </>
        )}
      </AsyncState>
    </div>
  );
}
