import { Fragment, useState } from 'react';
import styles from './Players.module.css';

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Сопоставление: у каждого левого элемента — выпадающий список перемешанных правых. */
export default function MatchingPlayer({ data, answer, setAnswer, result, disabled }) {
  const pairs = data.pairs.filter((p) => p.left.trim() && p.right.trim());
  const [rightOptions] = useState(() => shuffle(pairs.map((p) => ({ id: p.id, text: p.right }))));
  const current = answer ?? {};

  return (
    <>
      {data.instruction && <p className={styles.question}>{data.instruction}</p>}
      <div className={styles.pairs}>
        {pairs.map((pair) => {
          const ok = result?.results?.[pair.id];
          return (
            <Fragment key={pair.id}>
              <span className={styles.pairLeft}>{pair.left}</span>
              <select
                value={current[pair.id] ?? ''}
                onChange={(e) => setAnswer({ ...current, [pair.id]: e.target.value })}
                disabled={disabled}
                aria-label={`Пара для «${pair.left}»`}
              >
                <option value="">— выберите —</option>
                {rightOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text}
                  </option>
                ))}
              </select>
              <span className={`${styles.mark} ${ok ? styles.markOk : styles.markBad}`} aria-hidden={!result}>
                {result ? (ok ? '✓' : '✗') : ''}
              </span>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
