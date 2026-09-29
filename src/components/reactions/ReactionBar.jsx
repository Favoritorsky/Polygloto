import { REACTION_EMOJIS } from '../../../shared/schema.js';
import styles from './ReactionBar.module.css';

/**
 * Эмодзи-реакции (фиксированный набор). summary: { counts: {emoji: n}, mine }.
 * onToggle(emoji) — поставить/снять; без onToggle панель только показывает счётчики.
 */
export default function ReactionBar({ summary, onToggle, disabledReason }) {
  const counts = summary?.counts ?? {};
  const mine = summary?.mine ?? null;
  // Можно реагировать — показываем весь набор; нельзя — только то, что уже поставили другие.
  const visible = onToggle ? REACTION_EMOJIS : REACTION_EMOJIS.filter((e) => counts[e]);
  if (visible.length === 0) return null;
  return (
    <div className={styles.bar} role="group" aria-label="Реакции" title={onToggle ? undefined : disabledReason}>
      {visible.map((emoji) => {
        const count = counts[emoji] ?? 0;
        return (
          <button
            key={emoji}
            type="button"
            className={[styles.reaction, mine === emoji && styles.mine, !count && styles.empty].filter(Boolean).join(' ')}
            onClick={() => onToggle?.(emoji)}
            disabled={!onToggle}
            aria-pressed={mine === emoji}
            aria-label={`${emoji} ${count}`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
