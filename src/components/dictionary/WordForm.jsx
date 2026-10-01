import { useState } from 'react';
import { LIMITS, PARTS_OF_SPEECH } from '../../../shared/schema.js';
import AudioRefEditor from '../../audio/AudioRefEditor.jsx';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import { validateWord } from '../../services/dictionaryService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './WordForm.module.css';

const EMPTY = { word: '', translation: '', partOfSpeech: 'noun', examples: [''], notes: '', audio: null };

/** Форма статьи словаря (добавление и правка). onSubmit(value) → Promise. */
export default function WordForm({ initial, onSubmit, onCancel, submitLabel = 'Добавить' }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, examples: initial?.examples?.length ? initial.examples : [''] }));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setExample = (i, value) => setForm((f) => ({ ...f, examples: f.examples.map((x, k) => (k === i ? value : x)) }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateWord(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setError('');
    if (!initial) {
      // Добавление: форма очищается сразу, чтобы можно было вводить следующее
      // слово, не дожидаясь подтверждения сервера (и офлайн тоже). Если запись
      // не удалась — показываем ошибку и возвращаем введённое, если форма пуста.
      const submitted = form;
      setForm(EMPTY);
      try {
        await onSubmit(submitted);
      } catch (err) {
        setError(`«${submitted.word.trim()}» не сохранено: ${toUserMessage(err)}`);
        setForm((current) => (current === EMPTY ? submitted : current));
      }
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={styles.row}>
        <Field label="Слово" error={errors.word}>
          {(p) => <input {...p} value={form.word} maxLength={LIMITS.WORD_MAX} onChange={update('word')} />}
        </Field>
        <Field label="Перевод" error={errors.translation}>
          {(p) => <input {...p} value={form.translation} maxLength={LIMITS.TRANSLATION_MAX} onChange={update('translation')} />}
        </Field>
        <Field label="Часть речи" error={errors.partOfSpeech}>
          {(p) => (
            <select {...p} value={form.partOfSpeech} onChange={update('partOfSpeech')}>
              {PARTS_OF_SPEECH.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <fieldset className={styles.examples}>
        <legend>Примеры употребления</legend>
        {form.examples.map((example, i) => (
          <div key={i} className={styles.example}>
            <input
              value={example}
              maxLength={LIMITS.WORD_EXAMPLE_MAX}
              onChange={(e) => setExample(i, e.target.value)}
              aria-label={`Пример ${i + 1}`}
              placeholder="I love languages — я люблю языки"
            />
            {form.examples.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, examples: f.examples.filter((_, k) => k !== i) }))}>
                ✕
              </Button>
            )}
          </div>
        ))}
        {errors.examples && <p className={styles.error}>{errors.examples}</p>}
        {form.examples.length < LIMITS.WORD_EXAMPLES_MAX && (
          <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, examples: [...f.examples, ''] }))}>
            + пример
          </Button>
        )}
      </fieldset>
      <AudioRefEditor value={form.audio} onChange={(audio) => setForm((f) => ({ ...f, audio }))} label="Произношение (необязательно)" />
      <Field label="Заметки" error={errors.notes}>
        {(p) => <textarea {...p} rows={2} value={form.notes} maxLength={LIMITS.WORD_NOTES_MAX} onChange={update('notes')} />}
      </Field>
      <div className={styles.actions}>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
