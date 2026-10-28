import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCourseExport, exportFileName, IMPORT_LIMITS } from '../../../shared/courseExport.js';
import { LIMITS } from '../../../shared/schema.js';
import { newItemId } from '../../../shared/tasks.js';
import { AudioSourceContext } from '../../audio/audioSourceContext.js';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import ContentEditor from '../../components/editor/ContentEditor.jsx';
import DictionaryLinkTool from '../../components/editor/DictionaryLinkTool.jsx';
import { dictionaryLeafExtra } from '../../components/editor/editorLeafExtras.js';
import Alert from '../../components/ui/Alert.jsx';
import Button from '../../components/ui/Button.jsx';
import Tabs from '../../components/ui/Tabs.jsx';
import { buildDictionaryIndex } from '../../content/dictionaryIndex.js';
import { readAudioFile } from '../../services/audioService.js';
import { downloadJson, readImportFile } from '../../services/courseTransferService.js';
import { toUserMessage } from '../../services/errors.js';
import { clearLocalCourse, loadLocalCourse, saveLocalCourse } from '../../services/localCourseStore.js';
import readerStyles from '../course/SectionReader.module.css';
import editorStyles from '../editor/SectionEditor.module.css';
import listStyles from '../editor/SectionsTab.module.css';
import styles from './LocalCoursePage.module.css';

const TABS = [
  { id: 'lessons', label: 'Самоучитель' },
  { id: 'reference', label: 'Справочник' },
  { id: 'dictionary', label: 'Словарь' },
];
const SECTIONS_MAX = 200;

/** Разделам нужны id, чтобы выбирать и править их; в файл экспорта они не попадают. */
function withIds(data) {
  const ids = (list) => list.map((s) => ({ id: newItemId(), title: s.title, blocks: s.blocks }));
  return { ...data, lessons: ids(data.lessons), reference: ids(data.reference), warnings: undefined };
}

/**
 * «Открыть файл курса»: курс из JSON (формат экспорта Polygloto) проходится и
 * правится прямо в браузере. В базу ничего не пишется — ни курс, ни очки за
 * задания; правки хранятся в IndexedDB этого браузера и скачиваются обратно в JSON.
 */
export default function LocalCoursePage() {
  const [data, setData] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [mode, setMode] = useState('read');
  const [tab, setTab] = useState('lessons');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    loadLocalCourse()
      .then((saved) => saved && setData(saved))
      .catch(() => {})
      .finally(() => setRestoring(false));
  }, []);

  // Правки сохраняются в браузере с небольшой задержкой (первую загрузку не пересохраняем).
  useEffect(() => {
    if (!data) return undefined;
    if (!loaded.current) {
      loaded.current = true;
      return undefined;
    }
    const timer = setTimeout(() => saveLocalCourse(data).catch(() => setError('Не удалось сохранить правки в браузере.')), 400);
    return () => clearTimeout(timer);
  }, [data]);

  async function openFile(file) {
    if (!file) return;
    setError('');
    try {
      const parsed = await readImportFile(file);
      const next = withIds(parsed);
      loaded.current = true;
      setData(next);
      setWarnings(parsed.warnings ?? []);
      setMode('read');
      setTab('lessons');
      await saveLocalCourse(next);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  async function closeCourse() {
    if (!window.confirm('Закрыть курс? Несохранённые в файл правки пропадут — сначала скачайте JSON, если они нужны.')) return;
    await clearLocalCourse().catch(() => {});
    loaded.current = false;
    setData(null);
    setWarnings([]);
  }

  function download() {
    const file = buildCourseExport({
      course: data.course,
      lessons: data.lessons,
      reference: data.reference,
      dictionary: data.dictionary,
      audio: data.audio,
    });
    downloadJson(exportFileName(data.course.title), JSON.stringify(file, null, 2));
  }

  const updateCourse = useCallback((patch) => setData((d) => ({ ...d, course: { ...d.course, ...patch } })), []);
  const updateSections = useCallback((kind, updater) => setData((d) => ({ ...d, [kind]: updater(d[kind]) })), []);

  const dictionaryList = data?.dictionary;
  const audioList = data?.audio;
  const entries = useMemo(() => dictionaryList ?? [], [dictionaryList]);
  const dictionary = useMemo(() => buildDictionaryIndex(entries), [entries]);
  const audioById = useMemo(() => new Map((audioList ?? []).map((a) => [a.id, a.dataUrl])), [audioList]);
  const audioSource = useMemo(
    () => ({
      load: (id) => (audioById.has(id) ? Promise.resolve(audioById.get(id)) : Promise.reject(new Error('Аудиофайла нет в файле курса.'))),
      upload:
        mode === 'edit'
          ? async (file) => {
              if (audioById.size >= IMPORT_LIMITS.AUDIO_MAX) throw new Error(`В курсе уже ${IMPORT_LIMITS.AUDIO_MAX} аудиофайлов.`);
              const dataUrl = await readAudioFile(file);
              const id = newItemId();
              setData((d) => ({ ...d, audio: [...d.audio, { id, dataUrl, name: String(file.name ?? '').slice(0, 120) }] }));
              return id;
            }
          : undefined,
    }),
    [audioById, mode],
  );

  const picker = (
    <input
      ref={fileRef}
      type="file"
      accept=".json,application/json"
      hidden
      aria-label="Файл курса"
      onChange={(e) => {
        openFile(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (restoring) return <p className={styles.muted}>Загрузка…</p>;

  if (!data) {
    return (
      <div className={styles.page}>
        <h1>Открыть файл курса</h1>
        <p className={styles.lead}>
          Откройте курс в формате Polygloto JSON — скачанный со страницы курса или из «Настроек курса → Экспорт». Его можно проходить и
          править прямо здесь: в базу сайта ничего не записывается, вход не нужен, очки и награды не начисляются. Правки хранятся в этом
          браузере, а готовый курс можно скачать обратно в JSON.
        </p>
        {error && <Alert tone="error">{error}</Alert>}
        <div
          className={dragOver ? `${styles.drop} ${styles.dropActive}` : styles.drop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            openFile(e.dataTransfer.files?.[0]);
          }}
        >
          <p>Перетащите файл .json сюда</p>
          <Button onClick={() => fileRef.current?.click()}>Выбрать файл</Button>
          {picker}
        </div>
      </div>
    );
  }

  const { course } = data;
  const editing = mode === 'edit';
  return (
    <AudioSourceContext.Provider value={audioSource}>
      <article className={styles.page}>
        <header className={styles.header}>
          <p className={styles.language}>
            {course.language} · <span className={styles.badge}>локальный файл — не в базе сайта</span>
          </p>
          {editing ? (
            <div className={styles.metaForm}>
              <input
                className={styles.titleInput}
                value={course.title}
                maxLength={LIMITS.COURSE_TITLE_MAX}
                onChange={(e) => updateCourse({ title: e.target.value })}
                aria-label="Название курса"
              />
              <input
                value={course.language}
                maxLength={LIMITS.COURSE_LANGUAGE_MAX}
                onChange={(e) => updateCourse({ language: e.target.value })}
                aria-label="Язык курса"
              />
              <textarea
                rows={3}
                value={course.description}
                maxLength={LIMITS.COURSE_DESCRIPTION_MAX}
                onChange={(e) => updateCourse({ description: e.target.value })}
                aria-label="Описание курса"
              />
            </div>
          ) : (
            <>
              <h1 className={styles.title}>{course.title}</h1>
              {course.description && <p className={styles.description}>{course.description}</p>}
            </>
          )}
          <ul className={styles.stats}>
            <li>Уроков: {data.lessons.length}</li>
            <li>Разделов справочника: {data.reference.length}</li>
            <li>Слов в словаре: {data.dictionary.length}</li>
            <li>Аудио: {data.audio.length}</li>
          </ul>
          <div className={styles.actions}>
            <div className={styles.modes} role="group" aria-label="Режим">
              <Button size="sm" variant={editing ? 'secondary' : 'primary'} onClick={() => setMode('read')}>
                Проходить
              </Button>
              <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setMode('edit')}>
                Редактировать
              </Button>
            </div>
            <Button size="sm" variant="secondary" onClick={download}>
              Скачать JSON
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              Открыть другой файл
            </Button>
            <Button size="sm" variant="secondary" onClick={closeCourse}>
              Закрыть
            </Button>
            {picker}
          </div>
        </header>
        {error && <Alert tone="error">{error}</Alert>}
        {warnings.length > 0 && (
          <Alert tone="warning" title="Файл открыт с замечаниями">
            {warnings.join(' ')}
          </Alert>
        )}

        <Tabs tabs={TABS} active={tab} onChange={setTab} label="Разделы курса" sticky />
        {tab === 'dictionary' ? (
          <DictionaryBrowser entries={entries} />
        ) : (
          <Sections
            key={tab}
            kind={tab}
            sections={data[tab]}
            editing={editing}
            categories={course.categories ?? []}
            dictionary={dictionary}
            entries={entries}
            onSectionsChange={(updater) => updateSections(tab, updater)}
          />
        )}
      </article>
    </AudioSourceContext.Provider>
  );
}

/** Уроки или справочник: оглавление слева, выбранный раздел справа. */
function Sections({ kind, sections, editing, categories, dictionary, entries, onSectionsChange }) {
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? null);
  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === selectedId),
  );
  const current = sections[index] ?? null;
  const noun = kind === 'lessons' ? 'урок' : 'раздел';
  const leafExtra = useMemo(() => dictionaryLeafExtra(dictionary.byId), [dictionary]);

  const patchCurrent = useCallback(
    (patch) => onSectionsChange((list) => list.map((s) => (s.id === current?.id ? { ...s, ...patch } : s))),
    [onSectionsChange, current?.id],
  );
  const handleBlocks = useCallback((blocks) => patchCurrent({ blocks }), [patchCurrent]);

  function add() {
    const section = { id: newItemId(), title: kind === 'lessons' ? 'Новый урок' : 'Новый раздел', blocks: [] };
    onSectionsChange((list) => [...list, section]);
    setSelectedId(section.id);
  }
  function move(i, delta) {
    onSectionsChange((list) => {
      const next = [...list];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  }
  function remove(section) {
    if (!window.confirm(`Удалить ${noun} «${section.title}»?`)) return;
    onSectionsChange((list) => list.filter((s) => s.id !== section.id));
  }

  if (!editing) {
    if (!sections.length) return <p className={styles.muted}>Здесь пока пусто.</p>;
    return (
      <div className={readerStyles.layout}>
        <nav className={readerStyles.toc} aria-label="Оглавление">
          <ol>
            {sections.map((s, i) => (
              <li key={s.id}>
                <button type="button" className={s.id === current?.id ? readerStyles.active : undefined} onClick={() => setSelectedId(s.id)}>
                  <span className={readerStyles.number}>{i + 1}.</span> {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className={readerStyles.article}>
          <h2>{current.title}</h2>
          <ContentRenderer key={current.id} blocks={current.blocks} categories={categories} dictionary={dictionary} courseId="local" />
          {index < sections.length - 1 && (
            <div className={styles.next}>
              <Button
                onClick={() => {
                  setSelectedId(sections[index + 1].id);
                  window.scrollTo({ top: 0 });
                }}
              >
                Дальше: {sections[index + 1].title}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={listStyles.layout}>
      <aside className={listStyles.sidebar}>
        <ol className={listStyles.list}>
          {sections.map((s, i) => (
            <li key={s.id} className={s.id === current?.id ? listStyles.selected : undefined}>
              <button type="button" className={listStyles.itemButton} onClick={() => setSelectedId(s.id)} title={s.title}>
                <span className={listStyles.number}>{i + 1}.</span> {s.title}
              </button>
              <span className={listStyles.itemActions}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Ниже">
                  ↓
                </button>
                <button type="button" onClick={() => remove(s)} aria-label="Удалить">
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
        <Button size="sm" variant="secondary" onClick={add} disabled={sections.length >= SECTIONS_MAX}>
          + Добавить {noun}
        </Button>
      </aside>
      <div className={listStyles.editor}>
        {current ? (
          <div className={editorStyles.wrap}>
            <div className={editorStyles.toolbar}>
              <input
                className={editorStyles.title}
                value={current.title}
                maxLength={LIMITS.LESSON_TITLE_MAX}
                onChange={(e) => patchCurrent({ title: e.target.value })}
                aria-label="Название"
              />
            </div>
            <ContentEditor
              key={current.id}
              initialBlocks={current.blocks}
              onChange={handleBlocks}
              categories={categories}
              renderLeafExtra={leafExtra}
              extraTools={<DictionaryLinkTool entries={entries} />}
            />
          </div>
        ) : (
          <p className={styles.muted}>Добавьте {noun}, чтобы начать.</p>
        )}
      </div>
    </div>
  );
}
