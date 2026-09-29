import { useState } from 'react';
import { LIMITS } from '../../../shared/schema.js';
import Alert from '../ui/Alert.jsx';
import Button from '../ui/Button.jsx';
import Field from '../ui/Field.jsx';
import { createCourse, validateCourseMeta } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './CreateCourseForm.module.css';

export default function CreateCourseForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ title: '', language: '', description: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateCourseMeta(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    setError('');
    try {
      const courseId = await createCourse(form);
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
      <Field label="Язык" error={errors.language} hint="Например: эсперанто, квенья, токипона, ваш собственный конланг.">
        {(p) => <input {...p} maxLength={LIMITS.COURSE_LANGUAGE_MAX} value={form.language} onChange={update('language')} />}
      </Field>
      <Field label="Короткое описание" error={errors.description}>
        {(p) => (
          <textarea {...p} rows={3} maxLength={LIMITS.COURSE_DESCRIPTION_MAX} value={form.description} onChange={update('description')} />
        )}
      </Field>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" loading={submitting}>
          Создать черновик
        </Button>
      </div>
    </form>
  );
}
