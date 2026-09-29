import { useMemo, useState } from 'react';
import { Editor } from 'slate';
import { useSlate } from 'slate-react';
import { filterDictionary } from '../../content/dictionaryIndex.js';
import Popover from './Popover.jsx';
import { setMarkValue } from './slateModel.js';
import styles from './DictionaryLinkTool.module.css';

/** Инструмент тулбара: вручную привязать выделенный текст к статье словаря. */
export default function DictionaryLinkTool({ entries }) {
  const editor = useSlate();
  const [search, setSearch] = useState('');
  const current = Editor.marks(editor)?.dictRef;
  const found = useMemo(() => filterDictionary(entries, { search }).slice(0, 30), [entries, search]);
  const currentEntry = entries.find((e) => e.id === current);

  return (
    <Popover label={currentEntry ? `→ ${currentEntry.word}` : 'Словарь'} title="Привязать выделенный текст к слову из словаря" active={Boolean(current)}>
      {(close) => (
        <div className={styles.panel}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти слово"
            aria-label="Найти слово в словаре"
            autoFocus
          />
          {entries.length === 0 && <p className={styles.hint}>Словарь пуст — добавьте слова во вкладке «Словарь».</p>}
          <ul className={styles.list}>
            {found.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMarkValue(editor, 'dictRef', entry.id);
                    close();
                  }}
                >
                  <strong>{entry.word}</strong> — {entry.translation}
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <button
              type="button"
              className={styles.unlink}
              onMouseDown={(e) => {
                e.preventDefault();
                setMarkValue(editor, 'dictRef', null);
                close();
              }}
            >
              Отвязать от словаря
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
