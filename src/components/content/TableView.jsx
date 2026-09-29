import styles from './TableView.module.css';

/** Таблица только для чтения. */
export default function TableView({ block }) {
  const [head, ...body] = block.rows;
  const hasHeader = block.headerRow !== false && head;
  // Полностью пустые строки (заготовки автора) читателю не показываем.
  const rows = (hasHeader ? body : block.rows).filter((row) => row.cells.some((cell) => cell.trim()));
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        {hasHeader && (
          <thead>
            <tr>
              {head.cells.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.cells.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
