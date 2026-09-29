import { CONTENT_LIMITS } from '../../../../shared/content.js';
import { useUpdateElement } from './useUpdateElement.js';
import VoidBlockFrame from './VoidBlockFrame.jsx';
import styles from './TableElementEditor.module.css';

/** Редактор таблицы: ячейки — обычные поля ввода, строки/столбцы добавляются и удаляются кнопками. */
export default function TableElementEditor({ attributes, children, element, readOnly }) {
  const update = useUpdateElement(element);
  const rows = element.rows ?? [{ cells: [''] }];
  const width = rows[0]?.cells.length ?? 1;

  const setRows = (next) => update({ rows: next });
  const setCell = (r, c, value) =>
    setRows(rows.map((row, ri) => (ri === r ? { cells: row.cells.map((cell, ci) => (ci === c ? value : cell)) } : row)));
  const addRow = () => rows.length < CONTENT_LIMITS.TABLE_ROWS_MAX && setRows([...rows, { cells: Array(width).fill('') }]);
  const addCol = () => width < CONTENT_LIMITS.TABLE_COLS_MAX && setRows(rows.map((row) => ({ cells: [...row.cells, ''] })));
  const removeRow = (r) => rows.length > 1 && setRows(rows.filter((_, i) => i !== r));
  const removeCol = (c) => width > 1 && setRows(rows.map((row) => ({ cells: row.cells.filter((_, i) => i !== c) })));

  const content = (
    <>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <tbody>
            {!readOnly && (
              <tr>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} className={styles.control}>
                    <button type="button" onClick={() => removeCol(c)} disabled={width === 1} title="Удалить столбец">
                      − столбец
                    </button>
                  </td>
                ))}
                <td />
              </tr>
            )}
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 && element.headerRow !== false ? styles.headerRow : undefined}>
                {row.cells.map((cell, c) => (
                  <td key={c}>
                    <input
                      value={cell}
                      maxLength={CONTENT_LIMITS.TABLE_CELL_MAX}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      readOnly={readOnly}
                      aria-label={`Ячейка ${r + 1}:${c + 1}`}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className={styles.control}>
                    <button type="button" onClick={() => removeRow(r)} disabled={rows.length === 1} title="Удалить строку">
                      − строка
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className={styles.actions}>
          <button type="button" onClick={addRow} disabled={rows.length >= CONTENT_LIMITS.TABLE_ROWS_MAX}>
            + строка
          </button>
          <button type="button" onClick={addCol} disabled={width >= CONTENT_LIMITS.TABLE_COLS_MAX}>
            + столбец
          </button>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={element.headerRow !== false}
              onChange={(e) => update({ headerRow: e.target.checked })}
            />
            Первая строка — заголовок
          </label>
        </div>
      )}
    </>
  );

  return (
    <VoidBlockFrame attributes={attributes} element={element} title="Таблица" readOnly={readOnly} content={content}>
      {children}
    </VoidBlockFrame>
  );
}
