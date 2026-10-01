import { useState } from 'react';
import { Link } from 'react-router-dom';
import { collectLessonWords } from '../../content/dictionaryIndex.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import { toUserMessage } from '../../services/errors.js';
import { completeLesson } from '../../services/srsService.js';
import { plural } from '../../model/plural.js';
import styles from './LessonComplete.module.css';

/**
 * Конец урока: «Урок пройден» — отметка в прогрессе и все слова урока из
 * словаря курса в личное повторение. Повторное нажатие добавит только новые слова.
 */
export default function LessonComplete({ uid, courseId, lessonId, blocks, dictionaryIndex, completed }) {
  const [state, setState] = useState({ lessonId: null, saving: false, result: null, error: '' });
  const words = collectLessonWords(blocks, dictionaryIndex);
  const mine = state.lessonId === lessonId ? state : { saving: false, result: null, error: '' };

  if (!uid) {
    return (
      <div className={styles.box}>
        <p>
          <Link to="/login">Войдите</Link>, чтобы отмечать пройденные уроки и повторять их слова по карточкам.
        </p>
      </div>
    );
  }

  async function handleComplete() {
    setState({ lessonId, saving: true, result: null, error: '' });
    try {
      const result = await completeLesson(uid, courseId, lessonId, words);
      setState({ lessonId, saving: false, result, error: '' });
    } catch (err) {
      setState({ lessonId, saving: false, result: null, error: toUserMessage(err) });
    }
  }

  const done = completed || mine.result;
  return (
    <div className={done ? `${styles.box} ${styles.done}` : styles.box}>
      {mine.result ? (
        <p role="status">
          ✓ Урок пройден.{' '}
          {mine.result.added > 0
            ? `В повторение добавлено ${mine.result.added} ${plural(mine.result.added, ['слово', 'слова', 'слов'])}.`
            : 'Новых слов для повторения нет.'}{' '}
          <Link to="/review">Перейти к повторению</Link>
        </p>
      ) : (
        <p>
          {completed ? '✓ Урок пройден. ' : 'Дочитали урок? '}
          {words.length > 0
            ? `В уроке ${words.length} ${plural(words.length, ['слово', 'слова', 'слов'])} из словаря курса — их можно повторять по карточкам.`
            : 'Слов из словаря курса в этом уроке нет.'}
        </p>
      )}
      {mine.error && <Alert tone="error">{mine.error}</Alert>}
      {!mine.result && (
        <Button onClick={handleComplete} loading={mine.saving} variant={completed ? 'secondary' : 'primary'}>
          {completed ? 'Добавить слова урока в повторение' : 'Урок пройден'}
        </Button>
      )}
    </div>
  );
}
