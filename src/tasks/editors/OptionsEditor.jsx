import { TASK_LIMITS, newItemId } from '../../../shared/tasks.js';
import styles from './TaskEditors.module.css';

/**
 * Список вариантов ответа с отметкой правильных. multiple — несколько
 * правильных (флажки, correctOptionIds), иначе один (переключатель, correctOptionId).
 */
export default function OptionsEditor({ data, onChange, readOnly, multiple = false, min = TASK_LIMITS.OPTIONS_MIN }) {
  const correctIds = multiple ? (data.correctOptionIds ?? []) : [data.correctOptionId];
  const setOption = (id, text) =>
    onChange({
      ...data,
      options: data.options.map((o) => (o.id === id ? { ...o, text } : o)),
    });
  const toggleCorrect = (id) => {
    if (!multiple) onChange({ ...data, correctOptionId: id });
    else
      onChange({
        ...data,
        correctOptionIds: correctIds.includes(id) ? correctIds.filter((c) => c !== id) : [...correctIds, id],
      });
  };
  const removeOption = (id) => {
    const options = data.options.filter((o) => o.id !== id);
    if (multiple)
      onChange({
        ...data,
        options,
        correctOptionIds: correctIds.filter((c) => c !== id),
      });
    else
      onChange({
        ...data,
        options,
        correctOptionId: data.correctOptionId === id ? (options[0]?.id ?? null) : data.correctOptionId,
      });
  };
  return (
    <div className={styles.group}>
      <span className={styles.label}>{multiple ? 'Варианты (отметьте все правильные)' : 'Варианты (отметьте правильный)'}</span>
      {data.options.map((option, i) => (
        <div key={option.id} className={styles.row}>
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={`correct-${data.options[0]?.id}`}
            checked={correctIds.includes(option.id)}
            onChange={() => toggleCorrect(option.id)}
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
          {!readOnly && data.options.length > min && (
            <button type="button" className={styles.small} onClick={() => removeOption(option.id)} aria-label="Удалить вариант">
              ✕
            </button>
          )}
        </div>
      ))}
      {!readOnly && data.options.length < TASK_LIMITS.OPTIONS_MAX && (
        <button
          type="button"
          className={styles.add}
          onClick={() =>
            onChange({
              ...data,
              options: [...data.options, { id: newItemId(), text: '' }],
            })
          }
        >
          + вариант
        </button>
      )}
    </div>
  );
}
