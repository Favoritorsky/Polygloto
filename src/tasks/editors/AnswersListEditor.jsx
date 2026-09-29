import { TASK_LIMITS } from '../../../shared/tasks.js';
import styles from './TaskEditors.module.css';

/** Список допустимых ответов (первый — основной). */
export default function AnswersListEditor({ label, answers, onChange, readOnly, placeholder }) {
  const list = answers.length ? answers : [''];
  const set = (i, value) => onChange(list.map((a, k) => (k === i ? value : a)));
  return (
    <div className={styles.group}>
      <span className={styles.label}>{label}</span>
      {list.map((answer, i) => (
        <div key={i} className={styles.row}>
          <input
            value={answer}
            maxLength={TASK_LIMITS.ANSWER_MAX}
            onChange={(e) => set(i, e.target.value)}
            readOnly={readOnly}
            placeholder={i === 0 ? placeholder : 'Допустимый вариант'}
            aria-label={`${label} ${i + 1}`}
          />
          {!readOnly && list.length > 1 && (
            <button type="button" className={styles.small} onClick={() => onChange(list.filter((_, k) => k !== i))} aria-label="Удалить вариант">
              ✕
            </button>
          )}
        </div>
      ))}
      {!readOnly && list.length < TASK_LIMITS.ANSWERS_MAX && (
        <button type="button" className={styles.add} onClick={() => onChange([...list, ''])}>
          + допустимый вариант
        </button>
      )}
    </div>
  );
}
