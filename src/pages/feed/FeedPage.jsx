import { Link } from 'react-router-dom';
import CourseCard from '../../components/course/CourseCard.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { loadDisplayNames } from '../../services/gamificationService.js';
import { loadFeed, subscribeToFollowedAuthors } from '../../services/followService.js';
import styles from './FeedPage.module.css';

/** Лента: опубликованные курсы авторов, на которых подписан пользователь. */
export default function FeedPage() {
  const { user } = useAuth();
  const authors = useSubscription((onData, onError) => subscribeToFollowedAuthors(user.uid, onData, onError), user.uid);
  const key = authors.data ? authors.data.slice().sort().join(',') : null;
  const feed = useAsync(() => loadFeed(authors.data), key && authors.data.length > 0 ? key : null);
  const names = useAsync(() => loadDisplayNames(authors.data), key && authors.data.length > 0 ? `names:${key}` : null);

  return (
    <div className={styles.page}>
      <h1>Лента</h1>
      <AsyncState
        loading={authors.loading}
        error={authors.error}
        onRetry={authors.retry}
        empty={authors.data?.length === 0}
        emptyText="Вы пока ни на кого не подписаны. Откройте профиль автора и нажмите «Подписаться» — здесь появятся его новые курсы."
        emptyAction={<Link to="/catalog">Найти авторов в каталоге</Link>}
      >
        {authors.data?.length > 0 && (
          <>
            <p className={styles.following}>
              Вы подписаны:{' '}
              {authors.data.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <Link to={`/users/${id}`}>{names.data?.get(id) ?? '…'}</Link>
                </span>
              ))}
            </p>
            <AsyncState
              loading={feed.loading}
              error={feed.error}
              onRetry={feed.retry}
              empty={feed.data?.length === 0}
              emptyText="У этих авторов пока нет опубликованных курсов."
            >
              <ul className={styles.list}>
                {feed.data?.map((course) => (
                  <li key={course.id}>
                    {course.publishedAt && (
                      <p className={styles.date}>
                        Опубликован{' '}
                        {course.publishedAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                    <CourseCard course={course} />
                  </li>
                ))}
              </ul>
            </AsyncState>
          </>
        )}
      </AsyncState>
    </div>
  );
}
