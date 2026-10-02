import { useState } from 'react';
import { languageFieldsFromChoice } from '../../../shared/languages.js';
import { LIMITS } from '../../../shared/schema.js';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useCuratedLanguages } from '../../hooks/useCuratedLanguages.js';
import { createCourse, validateCourseMeta } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import LanguagePicker from './LanguagePicker.jsx';
import styles from './CreateCourseForm.module.css';

export default function CreateCourseForm({ onCreated, onCancel }) {
  const { user } = useAuth();
  const languages = useCuratedLanguages();
  const [form, setForm] = useState({ title: '', description: '' });
  const [languageChoice, setLanguageChoice] = useState({ languageId: '', customName: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const fields = languageFieldsFromChoice(languageChoice, languages.data ?? []);
    const nextErrors = validateCourseMeta({ ...form, language: fields?.language ?? '' });
    if (!fields) nextErrors.language = 'Выберите язык из списка или пункт «Другой язык».';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    setError('');
    try {
      const courseId = await createCourse(user.uid, { ...form, ...fields });
      onCreated(courseId);
    } catch (err) {
      setError(toUserMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Название курса" error={errors.title}>
        {(p) => <input {...p} maxLength={LIMITS.COURSE_TITLE_MAX} value={form.title} onChange={update('title')} autoFocus />}
      </Field>
      {languages.error && <Alert tone="error">Не удалось загрузить список языков. Обновите страницу.</Alert>}
      <LanguagePicker
        value={languageChoice}
        onChange={setLanguageChoice}
        languages={languages.data ?? []}
        error={errors.language}
        hint="Нет нужного языка? Выберите «Другой язык» и впишите название."
        readOnly={languages.loading}
      />
      <Field label="Короткое описание" error={errors.description}>
        {(p) => (
          <textarea {...p} rows={3} maxLength={LIMITS.COURSE_DESCRIPTION_MAX} value={form.description} onChange={update('description')} />
        )}
      </Field>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" loading={submitting} disabled={!languages.data}>
          Создать черновик
        </Button>
      </div>
    </form>
  );
}
