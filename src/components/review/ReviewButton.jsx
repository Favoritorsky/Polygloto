import { useState } from 'react';
import { toUserMessage } from '../../services/errors.js';
import styles from './ReviewButton.module.css';

/**
 * «+ В повторение» для слова опубликованного курса.
 * review — { wordIds: Set, adding: Set, add(entry) } из страницы курса.
 */
export default function ReviewButton({ entry, review, compact = false }) {
  const [error, setError] = useState('');
  if (review.wordIds.has(entry.id)) {
    return <span className={styles.done}>✓ В повторении</span>;
  }
  const busy = review.adding.has(entry.id);
  return (
    <>
      <button
        type="button"
        className={compact ? `${styles.button} ${styles.compact}` : styles.button}
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          setError('');
          review.add(entry).catch((err) => setError(toUserMessage(err)));
        }}
      >
        {busy ? 'Добавляем…' : '+ В повторение'}
      </button>
      {error && <span className={styles.error}>{error}</span>}
    </>
  );
}
