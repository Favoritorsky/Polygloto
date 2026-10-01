import RatingIcon from './RatingIcon.jsx';
import styles from './RatingButtons.module.css';

/**
 * Кнопки «нравится» / «не нравится» без привязки к базе: счётчики и свой голос
 * приходят снаружи. Используется в RatingButtons (курс) и в уроке-превью на главной.
 */
export default function RatingControl({ likes, dislikes, mine, onVote, disabled }) {
  const button = (value, direction, label, count) => (
    <button
      type="button"
      className={[styles.button, styles[value], mine === value && styles.active].filter(Boolean).join(' ')}
      onClick={() => onVote(value)}
      disabled={disabled}
      aria-pressed={mine === value}
      aria-label={`${label}: ${count}`}
    >
      <RatingIcon direction={direction} /> <span>{count}</span>
    </button>
  );
  return (
    <div className={styles.buttons}>
      {button('like', 'up', 'Нравится', likes)}
      {button('dislike', 'down', 'Не нравится', dislikes)}
    </div>
  );
}
