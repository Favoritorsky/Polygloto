import Badge from '../../components/ui/Badge.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import CardLink from '../../components/ui/CardLink.jsx';
import tile from '../../components/ui/CardLink.module.css';
import { useSubscription } from '../../hooks/useSubscription.js';
import { subscribeToReviewQueue } from '../../services/moderationService.js';
import styles from './AdminList.module.css';

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString('ru-RU') : '—';
}

export default function ReviewQueueTab() {
  const { data, loading, error, retry } = useSubscription(subscribeToReviewQueue, 'queue');
  return (
    <AsyncState loading={loading} error={error} onRetry={retry} empty={data?.length === 0} emptyText="Очередь пуста — все курсы проверены.">
      <ul className={styles.list}>
        {data?.map((course) => (
          <li key={course.id} className={`${styles.item} ${tile.tile}`}>
            <div className={styles.main}>
              <CardLink to={`/admin/review/${course.id}`} className={styles.title}>
                {course.title}
              </CardLink>
              <div className={styles.meta}>
                <span>{course.language}</span>
                <span>Отправлен {formatDate(course.submittedAt)}</span>
              </div>
            </div>
            {course.hasPublishedVersion ? <Badge tone="attention">Обновление</Badge> : <Badge>Новый курс</Badge>}
          </li>
        ))}
      </ul>
    </AsyncState>
  );
}
