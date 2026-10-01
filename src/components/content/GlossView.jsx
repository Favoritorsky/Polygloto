import { alignGloss, glossParts } from '../../../shared/gloss.js';
import styles from './GlossView.module.css';

/** Строка разбора одного слова: пометы (PL, 3SG) — капителью. */
export function GlossWord({ text }) {
  return glossParts(text).map((part, i) =>
    part.label ? (
      <abbr key={i} className={styles.label} title="грамматическая помета">
        {part.text.toLowerCase()}
      </abbr>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

/** Подстрочный разбор (v2): слова и их разбор столбиками, ниже — перевод. */
export default function GlossView({ block }) {
  const columns = alignGloss(block.source, block.gloss);
  if (columns.length === 0 && !block.translation) return null;
  return (
    <figure className={styles.gloss} aria-label="Подстрочный разбор">
      <div className={styles.lines}>
        {columns.map((column, i) => (
          <span key={i} className={styles.column}>
            <span className={styles.word}>{column.word || ' '}</span>
            <span className={styles.glossLine}>{column.gloss ? <GlossWord text={column.gloss} /> : ' '}</span>
          </span>
        ))}
      </div>
      {block.translation && <figcaption className={styles.translation}>‘{block.translation}’</figcaption>}
    </figure>
  );
}
