import { TASK_LIMITS, newItemId } from '../../../shared/tasks.js';
import styles from './TaskEditors.module.css';

export default function MatchingEditor({ data, onChange, readOnly }) {
  const setPair = (id, patch) => onChange({ ...data, pairs: data.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  return (
    <>
      <div className={styles.group}>
        <label className={styles.label}>
          Задание
          <input value={data.instruction} maxLength={TASK_LIMITS.TEXT_MAX} onChange={(e) => onChange({ ...data, instruction: e.target.value })} readOnly={readOnly} />
        </label>
      </div>
      <div className={styles.group}>
        <span className={styles.label}>Пары (читатель увидит правую колонку перемешанной)</span>
        {data.pairs.map((pair, i) => (
          <div key={pair.id} className={styles.row}>
            <input value={pair.left} maxLength={TASK_LIMITS.OPTION_MAX} onChange={(e) => setPair(pair.id, { left: e.target.value })} readOnly={readOnly} aria-label={`Левая часть ${i + 1}`} />
            <span>↔</span>
            <input value={pair.right} maxLength={TASK_LIMITS.OPTION_MAX} onChange={(e) => setPair(pair.id, { right: e.target.value })} readOnly={readOnly} aria-label={`Правая часть ${i + 1}`} />
            {!readOnly && data.pairs.length > TASK_LIMITS.PAIRS_MIN && (
              <button type="button" className={styles.small} onClick={() => onChange({ ...data, pairs: data.pairs.filter((p) => p.id !== pair.id) })} aria-label="Удалить пару">
                ✕
              </button>
            )}
          </div>
        ))}
        {!readOnly && data.pairs.length < TASK_LIMITS.PAIRS_MAX && (
          <button type="button" className={styles.add} onClick={() => onChange({ ...data, pairs: [...data.pairs, { id: newItemId(), left: '', right: '' }] })}>
            + пара
          </button>
        )}
      </div>
    </>
  );
}
