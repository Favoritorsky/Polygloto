import { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import { plural } from '../model/plural.js';
import { GAME_LIMITS, makeSpeedQuestion, readBest, saveBest } from './gameLogic.js';
import styles from './Games.module.css';

/** «На скорость»: за 60 секунд выбрать перевод как можно большего числа слов. */
export default function SpeedGame({ courseId, entries }) {
  const [game, setGame] = useState({ status: 'idle', score: 0, mistakes: 0, question: null, last: null, endsAt: 0 });
  const [left, setLeft] = useState(GAME_LIMITS.SPEED_SECONDS);
  const [best, setBest] = useState(() => readBest('speed', courseId));
  const [record, setRecord] = useState(false);
  // Счёт для таймера: обновляется в обработчиках, а не при рендере.
  const scoreRef = useRef(0);

  const { status, endsAt } = game;
  useEffect(() => {
    if (status !== 'playing') return undefined;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(timer);
        const score = scoreRef.current;
        const isRecord = score > 0 && saveBest('speed', courseId, score, (a, b) => a > b);
        if (isRecord) setBest(score);
        setRecord(isRecord);
        setGame((g) => ({ ...g, status: 'over' }));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [status, endsAt, courseId]);

  function start() {
    scoreRef.current = 0;
    setRecord(false);
    setLeft(GAME_LIMITS.SPEED_SECONDS);
    setGame({
      status: 'playing',
      score: 0,
      mistakes: 0,
      question: makeSpeedQuestion(entries),
      last: null,
      endsAt: Date.now() + GAME_LIMITS.SPEED_SECONDS * 1000,
    });
  }

  function answer(option) {
    if (game.status !== 'playing') return;
    const correct = option.id === game.question.id;
    const right = game.question.options.find((o) => o.id === game.question.id).text;
    if (correct) scoreRef.current = game.score + 1;
    setGame({
      ...game,
      score: game.score + (correct ? 1 : 0),
      mistakes: game.mistakes + (correct ? 0 : 1),
      last: correct ? { correct } : { correct, text: `${game.question.word} — ${right}` },
      question: makeSpeedQuestion(entries, game.question.id),
    });
  }

  function onKeyDown(event) {
    const n = Number(event.key);
    if (game.status === 'playing' && n >= 1 && n <= game.question.options.length) answer(game.question.options[n - 1]);
  }

  return (
    <section className={styles.game} aria-label="На скорость" onKeyDown={onKeyDown}>
      <p className={styles.status} role="status">
        {game.status === 'playing' ? (
          <>
            Осталось: {left} с · Верно: {game.score}
          </>
        ) : (
          <>За {GAME_LIMITS.SPEED_SECONDS} секунд переведите как можно больше слов: выбирайте верный вариант.</>
        )}
        {best !== null && <> · Рекорд: {best}</>}
      </p>
      {game.status === 'playing' && (
        <>
          <p className={styles.speedWord}>{game.question.word}</p>
          <div className={styles.speedOptions}>
            {game.question.options.map((o, i) => (
              <button key={`${game.question.id}-${o.id}`} type="button" className={styles.speedOption} onClick={() => answer(o)}>
                <kbd>{i + 1}</kbd> {o.text}
              </button>
            ))}
          </div>
          {game.last && !game.last.correct && <p className={styles.miss}>Правильно: {game.last.text}</p>}
        </>
      )}
      {game.status === 'over' && (
        <div className={styles.result} role="alert">
          <strong>
            Время вышло! Верно: {game.score} {plural(game.score, ['слово', 'слова', 'слов'])}, ошибок: {game.mistakes}.
          </strong>
          {record && <span> Новый рекорд! 🎉</span>}
        </div>
      )}
      {game.status !== 'playing' && <Button onClick={start}>{game.status === 'over' ? 'Сыграть ещё' : 'Начать'}</Button>}
    </section>
  );
}
