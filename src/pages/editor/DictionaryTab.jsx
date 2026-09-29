import { useState } from 'react';
import DictionaryBrowser from '../../components/dictionary/DictionaryBrowser.jsx';
import WordForm from '../../components/dictionary/WordForm.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { addWord, deleteWord, updateWord } from '../../services/dictionaryService.js';
import { toUserMessage } from '../../services/errors.js';
import { useCourseEditor } from './courseEditorContext.js';
import styles from './DictionaryTab.module.css';

/** Вкладка «Словарь» в редакторе: добавление, правка, удаление, поиск. */
export default function DictionaryTab() {
  const { courseId, readOnly, ensureDraft, dictionary } = useCourseEditor();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function handleAdd(word) {
    await ensureDraft();
    await addWord(courseId, word);
  }

  async function handleUpdate(word) {
    await ensureDraft();
    await updateWord(courseId, editing.id, word);
    setEditing(null);
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Удалить «${entry.word}» из словаря?`)) return;
    setError('');
    try {
      await ensureDraft();
      await deleteWord(courseId, entry.id);
    } catch (err) {
      setError(toUserMessage(err));
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        Слова из словаря автоматически подсвечиваются в уроках: читатель наводит курсор или нажимает на слово и видит
        перевод. В редакторе урока можно и вручную привязать фрагмент текста к статье (кнопка «Словарь» на панели).
      </p>
      {!readOnly && (
        <section className={styles.card}>
          <h2>Новое слово</h2>
          <WordForm onSubmit={handleAdd} />
        </section>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <AsyncState loading={dictionary.loading} error={dictionary.error} onRetry={dictionary.retry}>
        {dictionary.entries && (
          <DictionaryBrowser
            entries={dictionary.entries}
            renderActions={
              readOnly
                ? undefined
                : (entry) => (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(entry)}>
                        Изменить
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(entry)} aria-label={`Удалить ${entry.word}`}>
                        ✕
                      </Button>
                    </>
                  )
            }
          />
        )}
      </AsyncState>
      <Modal open={Boolean(editing)} title="Изменить слово" onClose={() => setEditing(null)}>
        {editing && <WordForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} submitLabel="Сохранить" />}
      </Modal>
    </div>
  );
}
