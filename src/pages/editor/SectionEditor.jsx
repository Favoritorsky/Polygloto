import { useCallback, useMemo, useRef, useState } from 'react';
import { LIMITS } from '../../../shared/schema.js';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import ContentEditor from '../../components/editor/ContentEditor.jsx';
import DictionaryLinkTool from '../../components/editor/DictionaryLinkTool.jsx';
import { dictionaryLeafExtra } from '../../components/editor/editorLeafExtras.js';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
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
  const { course, courseId, ensureDraft, dictionary } = useCourseEditor();
  const dictionaryEntries = useMemo(() => dictionary.entries ?? [], [dictionary.entries]);
  const leafExtra = useMemo(() => dictionaryLeafExtra(dictionary.index.byId), [dictionary.index]);
  const [title, setTitle] = useState(section.title ?? '');
  const [blocks, setBlocks] = useState(section.blocks ?? []);
  const [preview, setPreview] = useState(false);
  const categories = course.categories ?? [];
  // Последние значения обоих полей — чтобы каждое сохранение несло полный снимок.
  const latest = useRef({ title: section.title ?? '', blocks: section.blocks ?? [] });

  const save = useCallback(
    async (value) => {
      await ensureDraft();
      await saveSection(courseId, kind, section.id, value);
    },
    [courseId, kind, section.id, ensureDraft],
  );
  const { schedule, status, error, flush } = useAutosave(save);

  function handleTitleChange(event) {
    const next = event.target.value.slice(0, LIMITS.LESSON_TITLE_MAX);
    setTitle(next);
    latest.current = { ...latest.current, title: next };
    schedule(latest.current);
  }

  const handleBlocksChange = useCallback(
    (nextBlocks) => {
      setBlocks(nextBlocks);
      latest.current = { ...latest.current, blocks: nextBlocks };
      schedule(latest.current);
    },
    [schedule],
  );

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
        <SaveIndicator status={status} error={error} onRetry={flush} />
        <Button variant="secondary" size="sm" onClick={() => setPreview((p) => !p)}>
          {preview ? 'Редактировать' : 'Предпросмотр'}
        </Button>
      </div>
      {preview ? (
        <div className={styles.preview}>
          <ContentRenderer blocks={blocks} categories={categories} courseId={courseId} dictionary={dictionary.index} />
        </div>
      ) : (
        <ContentEditor
          initialBlocks={blocks}
          onChange={handleBlocksChange}
          categories={categories}
          readOnly={readOnly}
          renderLeafExtra={leafExtra}
          extraTools={<DictionaryLinkTool entries={dictionaryEntries} />}
        />
      )}
    </div>
  );
}
