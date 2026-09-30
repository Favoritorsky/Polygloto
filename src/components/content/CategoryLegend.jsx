import styles from './CategoryLegend.module.css';

/**
 * Легенда категорий разметки над текстом. used — Set id категорий, реально встречающихся в тексте.
 * С onToggle легенда интерактивная: каждая категория — кнопка-переключатель, скрывающая
 * её подсветку в тексте (hidden — Set скрытых id). Без onToggle — просто подписи.
 */
export default function CategoryLegend({ categories, used, hidden, onToggle, onShowAll }) {
  const visible = (categories ?? []).filter((c) => !used || used.has(c.id));
  if (visible.length === 0) return null;
  const hiddenCount = visible.filter((c) => hidden?.has(c.id)).length;
  return (
    <div className={styles.legend} role="group" aria-label="Легенда разметки">
      {onToggle && <span className={styles.caption}>Подсветка:</span>}
      {visible.map((c) => {
        const shown = !hidden?.has(c.id);
        const label = (
          <>
            <span className={styles.swatch} style={{ backgroundColor: shown ? c.color : 'transparent' }} aria-hidden="true" />
            {c.name}
            {c.abbr && <span className={styles.abbr}>{c.abbr}</span>}
          </>
        );
        if (!onToggle) {
          return (
            <span key={c.id} className={styles.item}>
              {label}
            </span>
          );
        }
        return (
          <button
            key={c.id}
            type="button"
            className={shown ? `${styles.item} ${styles.toggle}` : `${styles.item} ${styles.toggle} ${styles.off}`}
            aria-pressed={shown}
            title={shown ? `Скрыть подсветку «${c.name}»` : `Показать подсветку «${c.name}»`}
            onClick={() => onToggle(c.id)}
          >
            {label}
          </button>
        );
      })}
      {onShowAll && hiddenCount > 0 && (
        <button type="button" className={styles.showAll} onClick={onShowAll}>
          Показать все
        </button>
      )}
    </div>
  );
}
