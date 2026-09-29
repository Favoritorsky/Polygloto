import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { toUserMessage } from '../../services/errors.js';
import { setMyRating, subscribeToMyRating } from '../../services/ratingService.js';
import styles from './RatingButtons.module.css';

/** Оценка курса: 👍/👎, один голос, можно сменить или снять повторным нажатием. */
export default function RatingButtons({ course }) {
  const { user, isBanned } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isAuthor = user?.uid === course.authorId;
  const { data: mine } = useSubscription(
    (onData, onError) => subscribeToMyRating(course.id, user.uid, onData, onError),
    user && !isAuthor ? `${course.id}/${user.uid}` : null,
  );

  async function vote(value) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setMyRating(course.id, user.uid, mine === value ? null : value);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const canVote = user && !isAuthor && !isBanned;
  return (
    <div className={styles.wrap}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={mine === 'like' ? `${styles.button} ${styles.active}` : styles.button}
          onClick={() => vote('like')}
          disabled={!canVote || busy}
          aria-pressed={mine === 'like'}
          aria-label={`Нравится: ${course.likesCount ?? 0}`}
        >
          👍 <span>{course.likesCount ?? 0}</span>
        </button>
        <button
          type="button"
          className={mine === 'dislike' ? `${styles.button} ${styles.active}` : styles.button}
          onClick={() => vote('dislike')}
          disabled={!canVote || busy}
          aria-pressed={mine === 'dislike'}
          aria-label={`Не нравится: ${course.dislikesCount ?? 0}`}
        >
          👎 <span>{course.dislikesCount ?? 0}</span>
        </button>
      </div>
      {!user && (
        <span className={styles.hint}>
          <Link to="/login">Войдите</Link>, чтобы оценить курс
        </span>
      )}
      {isAuthor && <span className={styles.hint}>Это ваш курс</span>}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}
