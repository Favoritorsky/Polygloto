import { useState } from 'react';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useSubscription } from '../../hooks/useSubscription.js';
import { sortByOrder } from '../../model/courseStatus.js';
import {
  SECTION_KINDS,
  createSection,
  deleteSection,
  reorderSections,
  subscribeToSections,
} from '../../services/courseService.js';
import { toUserMessage } from '../../services/errors.js';
import { useCourseEditor } from './courseEditorContext.js';
import SectionEditor from './SectionEditor.jsx';
import styles from './SectionsTab.module.css';

const TEXT = {
  lessons: { add: '+ Урок', empty: 'В курсе пока нет уроков.', confirm: 'Удалить урок «%s»?', choose: 'Выберите урок слева.' },
  reference: {
    add: '+ Раздел',
    empty: 'Справочник пуст. Добавьте раздел — например, «Фонетика» или «Таблица спряжений».',
    confirm: 'Удалить раздел «%s»?',
    choose: 'Выберите раздел слева.',
  },
};

/** Список уроков/разделов справочника слева и редактор выбранного справа. */
export default function SectionsTab({ kind }) {
  const { course, courseId, readOnly, ensureDraft } = useCourseEditor();
  const { orderField } = SECTION_KINDS[kind];
  const text = TEXT[kind];
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { data, loading, error: loadError, retry } = useSubscription(
    (onData, onError) => subscribeToSections(courseId, kind, onData, onError),
    `${courseId}/${kind}`,
  );

  const sections = data ? sortByOrder(data, course[orderField]) : [];
  const selected = sections.find((s) => s.id === selectedId) ?? sections[0] ?? null;

  async function perform(action) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await ensureDraft();
      await action();
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const handleAdd = () =>
    perform(async () => {
      const id = await createSection(courseId, kind);
      setSelectedId(id);
    });

  const handleDelete = (section) => {
    if (!window.confirm(text.confirm.replace('%s', section.title || 'без названия'))) return;
    perform(async () => {
      await deleteSection(courseId, kind, section.id);
      if (selectedId === section.id) setSelectedId(null);
    });
  };

  const handleMove = (index, delta) =>
    perform(async () => {
      const order = sections.map((s) => s.id);
      const [moved] = order.splice(index, 1);
      order.splice(index + delta, 0, moved);
      await reorderSections(courseId, kind, order);
    });

  return (
    <AsyncState loading={loading} error={loadError} onRetry={retry}>
      {error && <Alert tone="error">{error}</Alert>}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <ol className={styles.list}>
            {sections.map((section, index) => (
              <li key={section.id} className={section.id === selected?.id ? styles.selected : undefined}>
                <button type="button" className={styles.itemButton} onClick={() => setSelectedId(section.id)}>
                  <span className={styles.number}>{index + 1}.</span> {section.title || 'Без названия'}
                </button>
                {!readOnly && (
                  <span className={styles.itemActions}>
                    <button type="button" onClick={() => handleMove(index, -1)} disabled={index === 0 || busy} aria-label="Выше">
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === sections.length - 1 || busy}
                      aria-label="Ниже"
                    >
                      ↓
                    </button>
                    <button type="button" onClick={() => handleDelete(section)} disabled={busy} aria-label="Удалить">
                      ✕
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {sections.length === 0 && <p className={styles.empty}>{text.empty}</p>}
          {!readOnly && (
            <Button variant="secondary" size="sm" onClick={handleAdd} loading={busy}>
              {text.add}
            </Button>
          )}
        </aside>
        <section className={styles.editor}>
          {selected ? (
            <SectionEditor key={selected.id} kind={kind} sectionId={selected.id} />
          ) : (
            <p className={styles.empty}>{sections.length ? text.choose : text.empty}</p>
          )}
        </section>
      </div>
    </AsyncState>
  );
}
