import AudioRefEditor from '../../../audio/AudioRefEditor.jsx';
import { useUpdateElement } from './useUpdateElement.js';
import VoidBlockFrame from './VoidBlockFrame.jsx';
import styles from './AudioElementEditor.module.css';

/** Аудиовставка в редакторе: запись (файл или ссылка) и подпись. */
export default function AudioElementEditor({ attributes, children, element, readOnly }) {
  const update = useUpdateElement(element);
  const content = (
    <>
      <AudioRefEditor value={element.audio} onChange={(audio) => update({ audio })} readOnly={readOnly} label="Запись" />
      <label className={styles.label}>
        Подпись (необязательно)
        <input
          value={element.caption ?? ''}
          maxLength={300}
          onChange={(e) => update({ caption: e.target.value })}
          readOnly={readOnly}
          placeholder="Например: диалог в кафе, медленно"
        />
      </label>
      {!element.audio && <p className={styles.hint}>Пока запись не выбрана, читатель этот блок не увидит.</p>}
    </>
  );
  return (
    <VoidBlockFrame attributes={attributes} element={element} title="Аудио" readOnly={readOnly} content={content}>
      {children}
    </VoidBlockFrame>
  );
}
