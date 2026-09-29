import styles from './Players.module.css';

export default function MultipleChoicePlayer({ data, answer, setAnswer, result, disabled, name }) {
  const options = data.options.filter((o) => o.text.trim());
  return (
    <>
      <p className={styles.question}>{data.question}</p>
      <div className={styles.options} role="radiogroup" aria-label={data.question}>
        {options.map((option) => {
          const chosen = answer === option.id;
          let className = styles.option;
          if (result && chosen) className += ` ${result.correct ? styles.optionCorrect : styles.optionWrong}`;
          return (
            <label key={option.id} className={className}>
              <input type="radio" name={name} checked={chosen} onChange={() => setAnswer(option.id)} disabled={disabled} />
              {option.text}
            </label>
          );
        })}
      </div>
    </>
  );
}
