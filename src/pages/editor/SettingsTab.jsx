import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LIMITS } from '../../../shared/schema.js';
import CategoryEditor from '../../components/course/CategoryEditor.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import SaveIndicator from '../../components/ui/SaveIndicator.jsx';
import { useAutosave } from '../../hooks/useAutosave.js';
import { deleteCourse, updateCourseMeta, validateCourseMeta } from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './SettingsTab.module.css';

/** Метаданные курса, категории разметки и удаление. */
export default function SettingsTab() {
  const { course, courseId, readOnly, ensureDraft, registerAutosave } = useCourseEditor();
  const navigate = useNavigate();
  // Локальная копия: входящие снимки не перетирают то, что сейчас печатается.
  const [form, setForm] = useState(() => ({
    title: course.title,
    language: course.language,
    description: course.description ?? '',
    categories: course.categories ?? [],
  }));
  const [errors, setErrors] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const save = useCallback(
    async (value) => {
      await ensureDraft();
      await updateCourseMeta(courseId, value);
    },
    [courseId, ensureDraft],
  );
  const autosave = useAutosave(save);
  const { flush, hasPending } = autosave;
  useEffect(() => registerAutosave({ flush, hasPending }), [registerAutosave, flush, hasPending]);

  function change(patch) {
    const next = { ...form, ...patch };
    setForm(next);
    const nextErrors = validateCourseMeta(next);
    const badCategory = next.categories.some((c) => !c.name.trim());
    if (badCategory) nextErrors.categories = 'У каждой категории должно быть название.';
    setErrors(nextErrors);
    // Невалидное не сохраняем: правила всё равно отклонят запись.
    if (Object.keys(nextErrors).length === 0) {
      autosave.schedule({
        ...next,
        categories: next.categories.map(({ abbr, ...c }) => ({ ...c, name: c.name.trim(), ...(abbr?.trim() && { abbr: abbr.trim() }) })),
      });
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить курс «${course.title}» навсегда? Опубликованная версия тоже исчезнет.`)) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteCourse(courseId);
      navigate('/my-courses', { replace: true });
    } catch (err) {
      setDeleteError(toUserMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Основное</h2>
          <SaveIndicator status={autosave.status} error={autosave.error} onRetry={autosave.flush} />
        </div>
        <Field label="Название" error={errors.title}>
          {(p) => (
            <input {...p} value={form.title} maxLength={LIMITS.COURSE_TITLE_MAX} readOnly={readOnly} onChange={(e) => change({ title: e.target.value })} />
          )}
        </Field>
        <Field label="Язык" error={errors.language} hint="По этому полю курс находят в каталоге.">
          {(p) => (
            <input {...p} value={form.language} maxLength={LIMITS.COURSE_LANGUAGE_MAX} readOnly={readOnly} onChange={(e) => change({ language: e.target.value })} />
          )}
        </Field>
        <Field label="Описание" error={errors.description}>
          {(p) => (
            <textarea
              {...p}
              rows={5}
              value={form.description}
              maxLength={LIMITS.COURSE_DESCRIPTION_MAX}
              readOnly={readOnly}
              onChange={(e) => change({ description: e.target.value })}
            />
          )}
        </Field>
      </section>

      <section className={styles.card}>
        <h2>Категории разметки текста</h2>
        {errors.categories && <Alert tone="error">{errors.categories}</Alert>}
        <CategoryEditor categories={form.categories} readOnly={readOnly} onChange={(categories) => change({ categories })} />
      </section>

      <section className={`${styles.card} ${styles.danger}`}>
        <h2>Удаление курса</h2>
        <p>Курс, все уроки, словарь, комментарии и оценки будут удалены без возможности восстановления.</p>
        {deleteError && <Alert tone="error">{deleteError}</Alert>}
        <Button variant="danger" onClick={handleDelete} loading={deleting}>
          Удалить курс
        </Button>
      </section>
    </div>
  );
}
