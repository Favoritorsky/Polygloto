import { useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';
import { plural } from '../model/plural.js';
import { makeMemoryCards, readBest, saveBest } from './gameLogic.js';
import styles from './Games.module.css';

const FLIP_BACK_MS = 900;

/** «Найди пары»: открыть по две карточки и найти слово и его перевод. */
export default function MemoryGame({ courseId, entries }) {
  const [round, setRound] = useState(() => newRound(entries));
  const [best, setBest] = useState(() => readBest('memory', courseId));
  const timer = useRef(null);

  function newRound(list) {
    return { cards: makeMemoryCards(list), open: [], matched: new Set(), moves: 0, startedAt: null, result: null };
  }

  function restart() {
    clearTimeout(timer.current);
    setRound(newRound(entries));
  }

  function flip(card) {
    if (round.result || round.open.length === 2 || round.open.includes(card.key) || round.matched.has(card.pairId)) return;
    const startedAt = round.startedAt ?? Date.now();
    const open = [...round.open, card.key];
    if (open.length < 2) {
      setRound({ ...round, open, startedAt });
      return;
    }
    const [a, b] = open.map((key) => round.cards.find((c) => c.key === key));
    const moves = round.moves + 1;
    if (a.pairId === b.pairId) {
      const matched = new Set(round.matched).add(a.pairId);
      const done = matched.size * 2 === round.cards.length;
      let result = null;
      if (done) {
        const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const record = saveBest('memory', courseId, moves, (x, y) => x < y);
        if (record) setBest(moves);
        result = { seconds, record };
      }
      setRound({ ...round, open: [], matched, moves, startedAt, result });
      return;
    }
    setRound({ ...round, open, moves, startedAt });
    timer.current = setTimeout(() => setRound((r) => ({ ...r, open: [] })), FLIP_BACK_MS);
  }

  const pairsLeft = round.cards.length / 2 - round.matched.size;
  return (
    <section className={styles.game} aria-label="Найди пары">
      <p className={styles.status} role="status">
        Ходов: {round.moves} · Осталось пар: {pairsLeft}
        {best !== null && (
          <>
            {' '}
            · Рекорд: {best} {plural(best, ['ход', 'хода', 'ходов'])}
          </>
        )}
      </p>
      <div className={styles.memoryGrid}>
        {round.cards.map((card, i) => {
          const isOpen = round.open.includes(card.key) || round.matched.has(card.pairId);
          const matched = round.matched.has(card.pairId);
          return (
            <button
              key={card.key}
              type="button"
              className={`${styles.memoryCard} ${isOpen ? styles.memoryOpen : ''} ${matched ? styles.memoryMatched : ''} ${card.side === 'word' ? styles.memoryWord : ''}`}
              onClick={() => flip(card)}
              disabled={matched}
              aria-label={isOpen ? card.text : `Карточка ${i + 1}`}
            >
              {isOpen ? card.text : '?'}
            </button>
          );
        })}
      </div>
      {round.result && (
        <div className={styles.result} role="alert">
          <strong>
            Все пары найдены за {round.moves} {plural(round.moves, ['ход', 'хода', 'ходов'])} и {round.result.seconds} с.
          </strong>
          {round.result.record && <span> Новый рекорд! 🎉</span>}
        </div>
      )}
      <Button variant={round.result ? 'primary' : 'secondary'} onClick={restart}>
        {round.result ? 'Сыграть ещё' : 'Перемешать заново'}
      </Button>
    </section>
  );
}
