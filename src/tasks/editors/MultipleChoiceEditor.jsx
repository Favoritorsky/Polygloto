import { TASK_LIMITS, newItemId } from '../../../shared/tasks.js';
import styles from './TaskEditors.module.css';

export default function MultipleChoiceEditor({ data, onChange, readOnly }) {
  const setOption = (id, text) => onChange({ ...data, options: data.options.map((o) => (o.id === id ? { ...o, text } : o)) });
  const removeOption = (id) => {
    const options = data.options.filter((o) => o.id !== id);
    onChange({ ...data, options, correctOptionId: data.correctOptionId === id ? options[0]?.id ?? null : data.correctOptionId });
  };
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Вопрос
          <input value={data.question} maxLength={TASK_LIMITS.TEXT_MAX} onChange={(e) => onChange({ ...data, question: e.target.value })} readOnly={readOnly} />
        </label>
      </div>
      <div className={styles.group}>
        <span className={styles.label}>Варианты (отметьте правильный)</span>
        {data.options.map((option, i) => (
          <div key={option.id} className={styles.row}>
            <input
              type="radio"
              name={`correct-${data.options[0]?.id}`}
              checked={data.correctOptionId === option.id}
              onChange={() => onChange({ ...data, correctOptionId: option.id })}
              disabled={readOnly}
              aria-label={`Вариант ${i + 1} правильный`}
            />
            <input
              value={option.text}
              maxLength={TASK_LIMITS.OPTION_MAX}
              onChange={(e) => setOption(option.id, e.target.value)}
              readOnly={readOnly}
              aria-label={`Вариант ${i + 1}`}
            />
            {!readOnly && data.options.length > TASK_LIMITS.OPTIONS_MIN && (
              <button type="button" className={styles.small} onClick={() => removeOption(option.id)} aria-label="Удалить вариант">
                ✕
              </button>
            )}
          </div>
        ))}
        {!readOnly && data.options.length < TASK_LIMITS.OPTIONS_MAX && (
          <button type="button" className={styles.add} onClick={() => onChange({ ...data, options: [...data.options, { id: newItemId(), text: '' }] })}>
            + вариант
          </button>
        )}
      </div>
    </>
  );
}
