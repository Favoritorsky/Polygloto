import { useState } from 'react';
import { normalizeAnswer, orderTokens } from '../../../shared/tasks.js';
import styles from './Players.module.css';

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Перемешивает слова так, чтобы порядок не совпал с правильным (если это вообще возможно). */
function shuffledWords(sentence) {
  const words = orderTokens(sentence).map((text, index) => ({ index, text }));
  const target = words.map((w) => normalizeAnswer(w.text)).join(' ');
  const distinct = new Set(words.map((w) => normalizeAnswer(w.text))).size > 1;
  let result = shuffle(words);
  for (let i = 0; distinct && i < 20 && result.map((w) => normalizeAnswer(w.text)).join(' ') === target; i += 1) result = shuffle(words);
  return result;
}

/**
 * Порядок слов: читатель нажимает слова из банка, они встают в строку ответа;
 * нажатие на слово в ответе возвращает его в банк. answer — массив индексов.
 */
export default function SentenceOrderPlayer({ data, answer, setAnswer, result, disabled }) {
  const [bank] = useState(() => shuffledWords(data.answers[0]));
  const placed = Array.isArray(answer) ? answer : [];
  const byIndex = new Map(bank.map((w) => [w.index, w]));
  const used = new Set(placed);

  return (
    <>
      {data.instruction && <p className={styles.question}>{data.instruction}</p>}
      {data.translation && <p className={styles.source}>{data.translation}</p>}
      <div
        className={`${styles.orderLine} ${result ? (result.correct ? styles.optionCorrect : styles.optionWrong) : ''}`}
        aria-label="Ваш ответ"
        role="group"
      >
        {placed.length === 0 && <span className={styles.placeholder}>Нажимайте слова ниже по порядку</span>}
        {placed.map((index, pos) => (
          <button
            key={index}
            type="button"
            className={styles.chip}
            onClick={() => setAnswer(placed.filter((_, k) => k !== pos))}
            disabled={disabled}
            aria-label={`Убрать «${byIndex.get(index)?.text}»`}
          >
            {byIndex.get(index)?.text}
          </button>
        ))}
      </div>
      <div className={styles.bank} role="group" aria-label="Слова">
        {bank.map((word) => (
          <button
            key={word.index}
            type="button"
            className={styles.chip}
            onClick={() => setAnswer([...placed, word.index])}
            disabled={disabled || used.has(word.index)}
            aria-hidden={used.has(word.index) || undefined}
          >
            {word.text}
          </button>
        ))}
      </div>
    </>
  );
}
