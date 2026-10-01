import { useState } from 'react';
import { Link } from 'react-router-dom';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { currentWeek, loadAllTimeLeaderboard, loadDisplayNames, loadWeeklyLeaderboard } from '../../services/gamificationService.js';
import { dayStart } from '../../../shared/gamification.js';
import styles from './LeaderboardPage.module.css';

const TABS = [
  { id: 'week', label: 'Эта неделя' },
  { id: 'all', label: 'За всё время' },
];

async function load(kind) {
  const entries = kind === 'week' ? await loadWeeklyLeaderboard() : await loadAllTimeLeaderboard();
  const names = await loadDisplayNames(entries.map((e) => e.uid));
  return entries.map((e) => ({ ...e, name: names.get(e.uid) }));
}

/** Рейтинг учеников: очки за неделю (с понедельника, UTC) и за всё время. */
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('week');
  const board = useAsync(() => load(tab), tab);
  const weekStart = dayStart(currentWeek() * 7 - 3).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });

  return (
    <div className={styles.page}>
      <h1>Рейтинг</h1>
      <p className={styles.muted}>
        Очки начисляются за задания, пройденные уроки и повторение слов.{' '}
        {tab === 'week' ? `Неделя началась ${weekStart} (по UTC).` : 'Топ-20 за всё время.'}
      </p>
      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Период рейтинга" />
      <AsyncState
        loading={board.loading}
        error={board.error}
        onRetry={board.retry}
        empty={board.data?.length === 0}
        emptyText={
          tab === 'week' ? 'На этой неделе ещё никто не набрал очков. Решите задание — и вы первый!' : 'Пока никто не набрал очков.'
        }
      >
        <ol className={styles.list}>
          {board.data?.map((entry, i) => (
            <li key={entry.uid} className={entry.uid === user?.uid ? styles.me : undefined}>
              <span className={styles.rank}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <Link to={`/users/${entry.uid}`} className={styles.name}>
                {entry.name ?? 'Без имени'}
                {entry.uid === user?.uid && <span className={styles.you}> (вы)</span>}
              </Link>
              <span className={styles.points}>{entry.points}</span>
            </li>
          ))}
        </ol>
      </AsyncState>
    </div>
  );
}
