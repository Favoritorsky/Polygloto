import { tableCellRole } from '../../../shared/content.js';
import styles from './TableView.module.css';

/** Ячейка по её роли: заголовки — <th> с нужным scope, угловая — отдельный служебный случай. */
function Cell({ role, children }) {
  if (role === 'corner') return <td className={styles.corner}>{children}</td>;
  if (role === 'column') return <th scope="col">{children}</th>;
  if (role === 'row') return <th scope="row">{children}</th>;
  return <td>{children}</td>;
}

/** Таблица только для чтения: заголовки в первой строке и/или в первом столбце. */
export default function TableView({ block }) {
  const hasHeaderRow = block.headerRow !== false && block.rows.length > 0;
  const indexed = block.rows.map((row, index) => ({ row, index }));
  // Полностью пустые строки (заготовки автора) читателю не показываем.
  const body = (hasHeaderRow ? indexed.slice(1) : indexed).filter(({ row }) => row.cells.some((cell) => cell.trim()));
  const renderRow = ({ row, index }) => (
    <tr key={index}>
      {row.cells.map((cell, c) => (
        <Cell key={c} role={tableCellRole(block, index, c)}>
          {cell}
        </Cell>
      ))}
    </tr>
  );
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        {hasHeaderRow && <thead>{renderRow(indexed[0])}</thead>}
        <tbody>{body.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
