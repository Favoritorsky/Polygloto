import AudioPlayer from '../../audio/AudioPlayer.jsx';
import Modal from '../ui/Modal.jsx';
import { POS_LABELS } from './partsOfSpeech.js';
import styles from './WordDetails.module.css';

/** Полная статья словаря в отдельном окне: открывается по клику на карточку слова. */
export default function WordDetails({ entry, onClose, renderActions }) {
  return (
    <Modal open={Boolean(entry)} title={entry?.word ?? ''} onClose={onClose} size="wide">
      {entry && (
        <div className={styles.details}>
          <div className={styles.summary}>
            {entry.pronunciation && <span className={styles.pronunciation}>{entry.pronunciation}</span>}
            {entry.audio && <AudioPlayer audio={entry.audio} label={`Произношение: ${entry.word}`} text="Послушать" />}
            <span className={styles.pos}>{POS_LABELS[entry.partOfSpeech] ?? entry.partOfSpeech}</span>
          </div>
          <section>
            <h3 className={styles.label}>Перевод</h3>
            <p className={styles.translation}>{entry.translation}</p>
          </section>
          {entry.examples?.length > 0 && (
            <section>
              <h3 className={styles.label}>{entry.examples.length > 1 ? 'Примеры' : 'Пример'}</h3>
              <ul className={styles.examples}>
                {entry.examples.map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>
            </section>
          )}
          {entry.notes && (
            <section>
              <h3 className={styles.label}>Заметки</h3>
              <p className={styles.notes}>{entry.notes}</p>
            </section>
          )}
          {renderActions && <div className={styles.actions}>{renderActions(entry)}</div>}
        </div>
      )}
    </Modal>
  );
}
