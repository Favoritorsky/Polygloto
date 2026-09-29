import { useMemo, useState } from 'react';
import { PARTS_OF_SPEECH } from '../../../shared/schema.js';
import { filterDictionary } from '../../content/dictionaryIndex.js';
import { POS_LABELS } from './partsOfSpeech.js';
import styles from './DictionaryBrowser.module.css';

const SORTS = [
  { id: 'word-asc', label: 'Слово А→Я' },
  { id: 'word-desc', label: 'Слово Я→А' },
  { id: 'translation-asc', label: 'Перевод А→Я' },
  { id: 'pos-asc', label: 'Часть речи' },
];

/**
 * Поиск, фильтр по части речи и сортировка словаря.
 * renderActions(entry) — кнопки справа (для автора), необязательно.
 */
export default function DictionaryBrowser({ entries, renderActions, highlightId }) {
  const [search, setSearch] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('all');
  const [sort, setSort] = useState('word-asc');
  const visible = useMemo(() => filterDictionary(entries, { search, partOfSpeech, sort }), [entries, search, partOfSpeech, sort]);

  return (
    <div>
      <div className={styles.controls}>
        <input
          type="search"
          placeholder="Поиск по слову или переводу"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Поиск по словарю"
        />
        <select value={partOfSpeech} onChange={(e) => setPartOfSpeech(e.target.value)} aria-label="Часть речи">
          <option value="all">Все части речи</option>
          {PARTS_OF_SPEECH.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.count}>
        {visible.length === entries.length ? `Слов: ${entries.length}` : `Найдено: ${visible.length} из ${entries.length}`}
      </p>
      {visible.length === 0 ? (
        <p className={styles.empty}>{entries.length ? 'Ничего не найдено.' : 'Словарь пока пуст.'}</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((entry) => (
            <li key={entry.id} id={`word-${entry.id}`} className={entry.id === highlightId ? `${styles.entry} ${styles.highlight}` : styles.entry}>
              <div className={styles.head}>
                <span className={styles.word}>{entry.word}</span>
                <span className={styles.pos}>{POS_LABELS[entry.partOfSpeech] ?? entry.partOfSpeech}</span>
                <span className={styles.translation}>{entry.translation}</span>
                {renderActions && <span className={styles.actions}>{renderActions(entry)}</span>}
              </div>
              {entry.examples?.length > 0 && (
                <ul className={styles.examples}>
                  {entry.examples.map((example, i) => (
                    <li key={i}>{example}</li>
                  ))}
                </ul>
              )}
              {entry.notes && <p className={styles.notes}>{entry.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
