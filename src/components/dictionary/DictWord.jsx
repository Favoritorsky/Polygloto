import AudioPlayer from '../../audio/AudioPlayer.jsx';
import { useId, useState } from 'react';
import { useContentContext } from '../content/contentContext.js';
import ReviewButton from '../review/ReviewButton.jsx';
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
  const { review } = useContentContext();

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
      onBlur={(e) => {
        // Фокус ушёл на кнопку внутри подсказки — подсказку не закрываем.
        if (e.currentTarget.contains(e.relatedTarget)) return;
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
                {entry.audio && (
                  // Клик по плееру не должен закреплять/снимать подсказку.
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
                    <AudioPlayer audio={entry.audio} label={`Произношение: ${entry.word}`} compact />
                  </span>
                )}
              </span>
              <span className={styles.translation}>{entry.translation}</span>
              {entry.examples?.[0] && <span className={styles.example}>{entry.examples[0]}</span>}
              {review && <ReviewButton entry={entry} review={review} compact />}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
