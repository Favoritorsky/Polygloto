import { useId, useState } from 'react';
import { POS_LABELS } from './partsOfSpeech.js';
import styles from './DictWord.module.css';

/**
 * «Активная ссылка» на словарь: подсвеченное слово, по наведению, фокусу или
 * нажатию показывает перевод и часть речи.
 */
export default function DictWord({ entries, className, style, title, children }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const visible = open || pinned;

  return (
    <span
      className={[styles.word, className].filter(Boolean).join(' ')}
      style={style}
      title={visible ? undefined : title}
      tabIndex={0}
      role="button"
      aria-expanded={visible}
      aria-describedby={visible ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => {
        setOpen(false);
        setPinned(false);
      }}
      onClick={() => setPinned((p) => !p)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setPinned(false);
          setOpen(false);
        }
      }}
    >
      {children}
      {visible && (
        <span className={styles.tooltip} role="tooltip" id={id}>
          {entries.map((entry) => (
            <span key={entry.id} className={styles.entry}>
              <span className={styles.head}>
                <strong>{entry.word}</strong> <em>{POS_LABELS[entry.partOfSpeech]}</em>
              </span>
              <span className={styles.translation}>{entry.translation}</span>
              {entry.examples?.[0] && <span className={styles.example}>{entry.examples[0]}</span>}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
