import styles from './Players.module.css';

/** Несколько правильных ответов: флажки; после проверки отмечены ошибки и пропущенные. */
export default function MultipleSelectPlayer({ data, answer, setAnswer, result, disabled }) {
  const options = data.options.filter((o) => o.text.trim());
  const chosen = new Set(Array.isArray(answer) ? answer : []);
  const toggle = (id) => {
    const next = new Set(chosen);
    if (!next.delete(id)) next.add(id);
    setAnswer(options.map((o) => o.id).filter((oid) => next.has(oid)));
  };
  return (
    <>
      <p className={styles.question}>{data.question}</p>
      <p className={styles.hint}>Выберите все правильные варианты.</p>
      <div className={styles.options} role="group" aria-label={data.question}>
        {options.map((option) => {
          const isChosen = chosen.has(option.id);
          const isCorrect = result?.correctIds?.includes(option.id);
          let className = styles.option;
          let note = null;
          if (result) {
            if (isChosen) className += ` ${isCorrect ? styles.optionCorrect : styles.optionWrong}`;
            else if (isCorrect && !result.correct) {
              className += ` ${styles.optionMissed}`;
              note = 'тоже правильный';
            }
          }
          return (
            <label key={option.id} className={className}>
              <input type="checkbox" checked={isChosen} onChange={() => toggle(option.id)} disabled={disabled} />
              {option.text}
              {note && <span className={styles.note}>{note}</span>}
            </label>
          );
        })}
      </div>
    </>
  );
}
