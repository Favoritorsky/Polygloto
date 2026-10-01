import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { plural } from '../../model/plural.js';
import { toUserMessage } from '../../services/errors.js';
import { countFollowers, follow, subscribeToFollowing, unfollow } from '../../services/followService.js';
import Button from '../ui/Button.jsx';
import styles from './FollowButton.module.css';

/** Число подписчиков автора и кнопка «Подписаться» / «Вы подписаны». */
export default function FollowButton({ authorId }) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const followers = useAsync(() => countFollowers(authorId), `${authorId}:${version}`);
  const canFollow = user && user.uid !== authorId;
  const following = useSubscription(
    (onData, onError) => subscribeToFollowing(user.uid, authorId, onData, onError),
    canFollow ? `${user.uid}:${authorId}` : null,
  );

  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (following.data) await unfollow(user.uid, authorId);
      else await follow(user.uid, authorId);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const count = followers.data ?? 0;
  return (
    <div className={styles.wrap}>
      <span className={styles.count}>
        {followers.loading ? '…' : count} {plural(count, ['подписчик', 'подписчика', 'подписчиков'])}
      </span>
      {canFollow && (
        <Button
          size="sm"
          variant={following.data ? 'secondary' : 'primary'}
          onClick={toggle}
          loading={busy}
          disabled={following.loading}
          aria-pressed={Boolean(following.data)}
        >
          {following.data ? '✓ Вы подписаны' : '+ Подписаться'}
        </Button>
      )}
      {!user && (
        <Link to="/login" className={styles.hint}>
          Войдите, чтобы подписаться
        </Link>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
