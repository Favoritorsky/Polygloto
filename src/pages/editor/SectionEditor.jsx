import { useCallback, useState } from 'react';
import { LIMITS } from '../../../shared/schema.js';
import AsyncState from '../../components/ui/AsyncState.jsx';
import SaveIndicator from '../../components/ui/SaveIndicator.jsx';
import { useAutosave } from '../../hooks/useAutosave.js';
import { useAsync } from '../../hooks/useSubscription.js';
import { getSection, saveSection } from '../../services/courseService.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './SectionEditor.module.css';

/**
 * Редактор одного урока / раздела справочника.
 * Контент грузится один раз (не live-подписка), чтобы входящие снимки не
 * затирали то, что автор печатает прямо сейчас. Сохранение — debounced.
 */
export default function SectionEditor({ kind, sectionId }) {
  const { courseId, readOnly } = useCourseEditor();
  const { data: section, loading, error, retry } = useAsync(
    () => getSection(courseId, kind, sectionId),
    `${courseId}/${kind}/${sectionId}`,
  );

  return (
    <AsyncState loading={loading} error={error} onRetry={retry} empty={section === null} emptyText="Раздел удалён.">
      {section && <LoadedSectionEditor kind={kind} section={section} readOnly={readOnly} />}
    </AsyncState>
  );
}

function LoadedSectionEditor({ kind, section, readOnly }) {
  const { courseId, ensureDraft } = useCourseEditor();
  const [title, setTitle] = useState(section.title ?? '');
  const [blocks] = useState(section.blocks ?? []);

  const save = useCallback(
    async (value) => {
      await ensureDraft();
      await saveSection(courseId, kind, section.id, value);
    },
    [courseId, kind, section.id, ensureDraft],
  );
  const autosave = useAutosave(save);

  function handleTitleChange(event) {
    const next = event.target.value.slice(0, LIMITS.LESSON_TITLE_MAX);
    setTitle(next);
    autosave.schedule({ title: next, blocks });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <input
          className={styles.title}
          value={title}
          onChange={handleTitleChange}
          placeholder={kind === 'lessons' ? 'Название урока' : 'Название раздела'}
          aria-label="Название"
          readOnly={readOnly}
        />
        <SaveIndicator status={autosave.status} error={autosave.error} onRetry={autosave.flush} />
      </div>
      <div className={styles.placeholder}>Редактор контента подключается на этапе 5.</div>
    </div>
  );
}
