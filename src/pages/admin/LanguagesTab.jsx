import { useState } from 'react';
import { LIMITS } from '../../../shared/schema.js';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useCuratedLanguages } from '../../hooks/useCuratedLanguages.js';
import { toUserMessage } from '../../services/errors.js';
import { addCuratedLanguage, deleteCuratedLanguage, renameCuratedLanguage, validateLanguageName } from '../../services/languageService.js';
import styles from './AdminList.module.css';

/**
 * Курируемый список языков: из него авторы выбирают язык курса, по нему
 * строится фильтр каталога. Курсы со своим языком («Другой язык») попадают
 * в фильтр «Конланги».
 */
export default function LanguagesTab() {
  const { data: languages, loading, error, retry } = useCuratedLanguages();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // { id, name }
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState('');

  async function run(key, action) {
    setBusy(key);
    setActionError('');
    try {
      await action();
      retry();
      return true;
    } catch (err) {
      setActionError(toUserMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handleAdd(event) {
    event.preventDefault();
    const problem = validateLanguageName(newName, languages ?? []);
    if (problem) return setActionError(problem);
    if (await run('add', () => addCuratedLanguage(newName))) setNewName('');
  }

  async function handleRename(language) {
    const problem = validateLanguageName(editing.name, languages ?? [], language.id);
    if (problem) return setActionError(problem);
    if (editing.name.trim() === language.name) return setEditing(null);
    if (await run(language.id, () => renameCuratedLanguage(language.id, language.name, editing.name))) setEditing(null);
  }

  async function handleDelete(language) {
    const ok = window.confirm(
      `Убрать «${language.name}» из списка? Курсы на этом языке не пропадут: они станут курсами со своим языком и будут видны в фильтре «Конланги».`,
    );
    if (ok) await run(language.id, () => deleteCuratedLanguage(language.id));
  }

  return (
    <div>
      <p className={styles.intro}>
        Языки из этого списка авторы выбирают при создании курса, и каждый из них — отдельный пункт фильтра в каталоге. Если языка нет в списке,
        автор выбирает «Другой язык» и вписывает название сам; такие курсы видны в фильтре «Конланги».
      </p>
      <form className={styles.addRow} onSubmit={handleAdd}>
        <input
          aria-label="Новый язык"
          placeholder="Название языка, например «Японский»"
          value={newName}
          maxLength={LIMITS.COURSE_LANGUAGE_MAX}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" loading={busy === 'add'}>
          Добавить
        </Button>
      </form>
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <AsyncState loading={loading} error={error} onRetry={retry} empty={languages?.length === 0} emptyText="Список пуст.">
        <ul className={styles.list}>
          {languages?.map((language) => (
            <li key={language.id} className={styles.item}>
              <div className={styles.main}>
                {editing?.id === language.id ? (
                  <input
                    aria-label={`Новое название для «${language.name}»`}
                    value={editing.name}
                    maxLength={LIMITS.COURSE_LANGUAGE_MAX}
                    autoFocus
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(language);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                ) : (
                  <span className={styles.title}>{language.name}</span>
                )}
              </div>
              {editing?.id === language.id ? (
                <>
                  <Button size="sm" loading={busy === language.id} onClick={() => handleRename(language)}>
                    Сохранить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Отмена
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ id: language.id, name: language.name })}>
                    Переименовать
                  </Button>
                  <Button size="sm" variant="danger" loading={busy === language.id} onClick={() => handleDelete(language)}>
                    Удалить
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
