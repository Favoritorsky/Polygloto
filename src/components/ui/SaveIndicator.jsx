import { toUserMessage } from '../../services/errors.js';
import styles from './SaveIndicator.module.css';

const LABELS = {
  idle: '',
  pending: 'Есть несохранённые изменения…',
  saving: 'Сохранение…',
  saved: 'Все изменения сохранены',
  error: 'Не сохранено',
};

export default function SaveIndicator({ status, error, onRetry }) {
  if (status === 'idle') return null;
  return (
    <span className={`${styles.indicator} ${styles[status]}`} role="status" aria-live="polite">
      {LABELS[status]}
      {status === 'error' && (
        <>
          {': '}
          {toUserMessage(error)}{' '}
          {onRetry && (
            <button type="button" className={styles.retry} onClick={onRetry}>
              Повторить
            </button>
          )}
        </>
      )}
    </span>
  );
}
