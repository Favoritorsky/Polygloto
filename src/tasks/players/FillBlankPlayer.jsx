import styles from './Players.module.css';

export default function FillBlankPlayer({ data, answer, setAnswer, disabled }) {
  return (
    <div className={styles.sentence}>
      {data.before && <span>{data.before}</span>}
      <input
        className={styles.blank}
        value={answer ?? ''}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={disabled}
        aria-label="Пропущенное слово"
        autoComplete="off"
        spellCheck={false}
      />
      {data.after && <span>{data.after}</span>}
    </div>
  );
}
