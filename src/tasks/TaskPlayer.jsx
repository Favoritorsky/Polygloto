import { useId, useState } from 'react';
import { useContentContext } from '../components/content/contentContext.js';
import Button from '../components/ui/Button.jsx';
import { getTaskType } from './taskTypeRegistry.js';
import styles from './TaskPlayer.module.css';

/**
 * Прохождение задания: общий «каркас» (Проверить / Ещё раз / обратная связь)
 * вокруг Player конкретного типа из реестра.
 */
export default function TaskPlayer({ block, index }) {
  const type = getTaskType(block.taskType);
  const { onTaskChecked } = useContentContext();
  const [answer, setAnswer] = useState(null);
  const [result, setResult] = useState(null);
  const name = useId();

  if (!type) return <div className={styles.card}>Неизвестный тип задания.</div>;
  if (type.problems(block.data).length > 0) {
    return <div className={styles.card}>Задание ещё не готово.</div>;
  }

  const { Player } = type;
  const complete = type.isComplete(block.data, answer);

  function handleCheck(event) {
    event.preventDefault();
    if (!complete) return;
    const checked = type.check(block.data, answer);
    setResult(checked);
    onTaskChecked?.(block, index, checked.correct);
  }

  function handleRetry() {
    setResult(null);
    setAnswer(null);
  }

  return (
    <form className={styles.card} onSubmit={handleCheck} aria-label={`Задание: ${type.label}`}>
      <div className={styles.kind}>Задание · {type.label}</div>
      <Player data={block.data} answer={answer} setAnswer={setAnswer} result={result} disabled={Boolean(result)} name={name} />
      <div className={styles.footer}>
        {!result && (
          <Button type="submit" size="sm" disabled={!complete}>
            Проверить
          </Button>
        )}
        {result && (
          <>
            <span className={result.correct ? styles.correct : styles.wrong} role="status">
              {result.correct ? '✓ Верно!' : '✗ Пока неверно.'}
              {!result.correct && result.expected && <> Правильный вариант: «{result.expected}».</>}
            </span>
            <Button variant="secondary" size="sm" onClick={handleRetry}>
              Ещё раз
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
