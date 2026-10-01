import { GLOSS_LIMITS, glossMismatch } from '../../../../shared/gloss.js';
import GlossView from '../../content/GlossView.jsx';
import { useUpdateElement } from './useUpdateElement.js';
import VoidBlockFrame from './VoidBlockFrame.jsx';
import styles from './GlossElementEditor.module.css';

/** Подстрочный разбор в редакторе: три строки и живой предпросмотр. */
export default function GlossElementEditor({ attributes, children, element, readOnly }) {
  const update = useUpdateElement(element);
  const mismatch = glossMismatch(element.source, element.gloss);
  const field = (key, label, placeholder) => (
    <label className={styles.label}>
      {label}
      <input
        value={element[key] ?? ''}
        maxLength={GLOSS_LIMITS.LINE_MAX}
        onChange={(e) => update({ [key]: e.target.value })}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </label>
  );
  const content = (
    <>
      {field('source', 'Предложение', 'los gatos duermen')}
      {field('gloss', 'Разбор по словам', 'DEF.PL кот-PL спать.PRS-3PL')}
      {field('translation', 'Перевод', 'кошки спят')}
      <p className={styles.hint}>
        Слова разбора идут в том же порядке, что и слова предложения, через пробел. Морфемы — через дефис, пометы — заглавными латинскими
        (PL, 3SG, PST): читатель увидит их капителью.
      </p>
      {mismatch && (
        <p className={styles.warning} role="status">
          В предложении {mismatch.source} сл., в разборе {mismatch.gloss}: столбцы не совпадут.
        </p>
      )}
      {(element.source || element.gloss) && (
        <div className={styles.preview} aria-label="Предпросмотр разбора">
          <GlossView block={element} />
        </div>
      )}
    </>
  );
  return (
    <VoidBlockFrame attributes={attributes} element={element} title="Подстрочный разбор" readOnly={readOnly} content={content}>
      {children}
    </VoidBlockFrame>
  );
}
