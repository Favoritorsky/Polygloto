import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LIMITS } from '../../../shared/schema.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useAsync } from '../../hooks/useSubscription.js';
import { findUserByProfileRef, setCoAuthors } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { loadDisplayNames } from '../../services/gamificationService.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './SettingsTab.module.css';

/**
 * Соавторы (v2): автор добавляет их по ссылке на профиль или id и убирает.
 * Соавторы правят черновик наравне с автором, но не удаляют курс и не меняют этот список.
 */
export default function CoAuthorsSection() {
  const { course, courseId, isAuthor } = useCourseEditor();
  const coAuthors = course.coAuthors ?? [];
  const names = useAsync(() => loadDisplayNames(coAuthors), coAuthors.length > 0 ? coAuthors.join(',') : null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(next) {
    setBusy(true);
    setError('');
    try {
      await setCoAuthors(courseId, next);
      return true;
    } catch (err) {
      setError(toUserMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    setError('');
    if (coAuthors.length >= LIMITS.COAUTHORS_MAX) return setError(`Не больше ${LIMITS.COAUTHORS_MAX} соавторов.`);
    setBusy(true);
    let found;
    try {
      found = await findUserByProfileRef(input);
    } catch (err) {
      setBusy(false);
      return setError(toUserMessage(err));
    }
    setBusy(false);
    if (!found) return setError('Пользователь не найден. Вставьте ссылку на его профиль или id.');
    if (found.uid === course.authorId) return setError('Это автор курса.');
    if (coAuthors.includes(found.uid)) return setError('Этот пользователь уже соавтор.');
    if (await save([...coAuthors, found.uid])) setInput('');
  }

  return (
    <section className={styles.card} aria-label="Соавторы">
      <h2>Соавторы</h2>
      <p className={styles.note}>
        Соавторы правят уроки, справочник и словарь и отправляют курс на проверку. Удалить курс и изменить список соавторов может только
        автор.
      </p>
      {coAuthors.length === 0 ? (
        <p className={styles.note}>Соавторов пока нет.</p>
      ) : (
        <ul className={styles.coAuthors}>
          {coAuthors.map((uid) => (
            <li key={uid}>
              <Link to={`/users/${uid}`}>{names.data?.get(uid) ?? (names.loading ? '…' : 'Пользователь удалён')}</Link>
              {isAuthor && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Убрать соавтора ${names.data?.get(uid) ?? uid}`}
                  onClick={() => save(coAuthors.filter((id) => id !== uid))}
                >
                  Убрать
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {isAuthor && coAuthors.length < LIMITS.COAUTHORS_MAX && (
        <form className={styles.coAuthorForm} onSubmit={handleAdd}>
          <Field label="Ссылка на профиль или id пользователя" hint="Откройте профиль будущего соавтора и скопируйте адрес страницы.">
            {(p) => <input {...p} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://…/users/…" />}
          </Field>
          <Button type="submit" variant="secondary" loading={busy} disabled={!input.trim()}>
            Добавить соавтора
          </Button>
        </form>
      )}
    </section>
  );
}
