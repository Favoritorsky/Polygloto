import styles from './Players.module.css';

/** Ввод текстом: перевод предложения и «введи ответ сам». */
export function TranslationPlayer({ data, answer, setAnswer, disabled }) {
  return (
    <>
      <p className={styles.question}>Переведите:</p>
      <p className={styles.source}>{data.source}</p>
      <textarea rows={2} value={answer ?? ''} onChange={(e) => setAnswer(e.target.value)} disabled={disabled} aria-label="Ваш перевод" spellCheck={false} />
    </>
  );
}

export function FreeInputPlayer({ data, answer, setAnswer, disabled }) {
  return (
    <>
      <p className={styles.question}>{data.question}</p>
      <input value={answer ?? ''} onChange={(e) => setAnswer(e.target.value)} disabled={disabled} aria-label="Ваш ответ" autoComplete="off" spellCheck={false} />
    </>
  );
}
