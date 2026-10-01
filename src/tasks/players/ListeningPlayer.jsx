import AudioPlayer from '../../audio/AudioPlayer.jsx';
import MultipleChoicePlayer from './MultipleChoicePlayer.jsx';
import styles from './Players.module.css';

/** Аудирование: запись + выбор варианта или ввод; после проверки — расшифровка. */
export default function ListeningPlayer(props) {
  const { data, answer, setAnswer, result, disabled } = props;
  return (
    <>
      <div className={styles.listen}>
        <AudioPlayer audio={data.audio} label="Слушать запись" />
      </div>
      {data.mode === 'input' ? (
        <>
          <p className={styles.question}>{data.question}</p>
          <input
            value={answer ?? ''}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={disabled}
            aria-label="Ваш ответ"
            autoComplete="off"
            spellCheck={false}
          />
        </>
      ) : (
        <MultipleChoicePlayer {...props} />
      )}
      {result && data.transcript && (
        <p className={styles.transcript}>
          <span className={styles.note}>Расшифровка:</span> {data.transcript}
        </p>
      )}
    </>
  );
}
