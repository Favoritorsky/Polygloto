import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SRS_GRADES, formatInterval, reviewCard } from '../../../shared/srs.js';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { toUserMessage } from '../../services/errors.js';
import { countAllCards, loadDueCards, nextDueDate, submitReview } from '../../services/srsService.js';
import styles from './ReviewPage.module.css';

function formatDate(date) {
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** Пустое состояние: карточек нет вообще или всё повторено. */
function Empty({ uid, reviewed }) {
  const info = useAsync(async () => ({ total: await countAllCards(uid), next: await nextDueDate(uid) }), `${uid}/${reviewed}`);
  if (info.loading || !info.data) return null;
  if (info.data.total === 0) {
    return (
      <div className={styles.empty}>
        <h2>Слов для повторения пока нет</h2>
        <p>
          Откройте урок в <Link to="/catalog">каталоге</Link> и нажмите «Урок пройден»: слова урока попадут сюда. Отдельное слово
          можно добавить из словаря курса кнопкой «В повторение».
        </p>
      </div>
    );
  }
  return (
    <div className={styles.empty}>
      <h2>{reviewed > 0 ? `Готово! Повторено слов: ${reviewed}` : 'На сегодня всё повторено'}</h2>
      <p>
        Карточек в повторении: {info.data.total}.
        {info.data.next && <> Следующие слова будут готовы {formatDate(info.data.next)}.</>}
      </p>
    </div>
  );
}

/** Повторение: слово → вспомнить перевод → показать ответ → оценить. */
export default function ReviewPage() {
  const { user } = useAuth();
  const uid = user.uid;
  const [session, setSession] = useState(0);
  const due = useAsync(() => loadDueCards(uid), `${uid}/${session}`);
  // Повторённые в этой сессии карточки убираем из загруженного списка.
  const [doneIds, setDoneIds] = useState(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reviewed, setReviewed] = useState(0);

  const queue = (due.data ?? []).filter((c) => !doneIds.has(c.id));
  const card = queue[0];

  const grade = useCallback(
    async (gradeId) => {
      if (!card || saving) return;
      setSaving(true);
      setError('');
      try {
        await submitReview(uid, card, gradeId);
        setReviewed((n) => n + 1);
        // «Забыл» — карточка вернётся через 10 минут (правила не дают повторить её раньше).
        setDoneIds((ids) => new Set(ids).add(card.id));
        setRevealed(false);
      } catch (err) {
        setError(toUserMessage(err));
      } finally {
        setSaving(false);
      }
    },
    [card, saving, uid],
  );

  // Клавиатура: пробел — показать ответ, 1–4 — оценка.
  useEffect(() => {
    const onKey = (e) => {
      if (!card || e.target.closest('input, textarea, select, button')) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        grade(SRS_GRADES[Number(e.key) - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, revealed, grade]);

  return (
    <div className={styles.page}>
      <h1>Повторение слов</h1>
      <AsyncState loading={due.loading} error={due.error} onRetry={due.retry} loadingLabel="Собираем карточки…">
        {card ? (
          <>
            <p className={styles.progress}>
              Осталось: {queue.length}
              {reviewed > 0 && ` · повторено: ${reviewed}`}
            </p>
            <section className={styles.card} aria-label="Карточка" aria-live="polite">
              <p className={styles.word}>{card.word}</p>
              {revealed ? (
                <p className={styles.answer}>{card.translation}</p>
              ) : (
                <p className={styles.hint}>Вспомните перевод, затем откройте ответ.</p>
              )}
            </section>
            {error && <Alert tone="error">{error}</Alert>}
            {revealed ? (
              <div className={styles.grades} role="group" aria-label="Насколько легко вспомнили">
                {SRS_GRADES.map((g, i) => (
                  <Button
                    key={g.id}
                    variant={g.id === 'again' ? 'secondary' : 'primary'}
                    onClick={() => grade(g.id)}
                    disabled={saving}
                  >
                    <span>{g.label}</span>
                    <small>
                      {formatInterval(reviewCard(card, g.id).dueMinutes)} · {i + 1}
                    </small>
                  </Button>
                ))}
              </div>
            ) : (
              <div className={styles.grades}>
                <Button onClick={() => setRevealed(true)}>Показать ответ</Button>
              </div>
            )}
          </>
        ) : (
          due.data && (
            <>
              <Empty uid={uid} reviewed={reviewed} />
              {reviewed > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReviewed(0);
                    setDoneIds(new Set());
                    setSession((s) => s + 1);
                  }}
                >
                  Проверить ещё раз
                </Button>
              )}
            </>
          )
        )}
      </AsyncState>
    </div>
  );
}
