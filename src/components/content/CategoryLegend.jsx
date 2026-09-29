import styles from './CategoryLegend.module.css';

/** Легенда категорий разметки над текстом. used — Set id категорий, реально встречающихся в тексте. */
export default function CategoryLegend({ categories, used }) {
  const visible = (categories ?? []).filter((c) => !used || used.has(c.id));
  if (visible.length === 0) return null;
  return (
    <div className={styles.legend} aria-label="Легенда разметки">
      {visible.map((c) => (
        <span key={c.id} className={styles.item}>
          <span className={styles.swatch} style={{ backgroundColor: c.color }} aria-hidden="true" />
          {c.name}
        </span>
      ))}
    </div>
  );
}
