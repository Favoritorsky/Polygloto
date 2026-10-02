import AudioPlayer from '../../audio/AudioPlayer.jsx';
import { useMemo, useState } from 'react';
import { PARTS_OF_SPEECH } from '../../../shared/schema.js';
import { filterDictionary } from '../../content/dictionaryIndex.js';
import { POS_LABELS } from './partsOfSpeech.js';
import tile from '../ui/CardLink.module.css';
import WordDetails from './WordDetails.jsx';
import styles from './DictionaryBrowser.module.css';

const SORTS = [
  { id: 'word-asc', label: 'Слово А→Я' },
  { id: 'word-desc', label: 'Слово Я→А' },
  { id: 'translation-asc', label: 'Перевод А→Я' },
  { id: 'pos-asc', label: 'Часть речи' },
];

/**
 * Поиск, фильтр по части речи и сортировка словаря.
 * Клик по карточке открывает полную статью в отдельном окне (WordDetails).
 * renderActions(entry) — кнопки справа и в окне статьи (для автора), необязательно.
 */
export default function DictionaryBrowser({ entries, renderActions, highlightId }) {
  const [search, setSearch] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('all');
  const [sort, setSort] = useState('word-asc');
  // Храним id, а не объект: после правки в окне видна свежая версия, после удаления окно закрывается.
  const [openId, setOpenId] = useState(null);
  const opened = openId ? (entries.find((e) => e.id === openId) ?? null) : null;
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
            <li
              key={entry.id}
              id={`word-${entry.id}`}
              className={[styles.entry, tile.tile, entry.id === highlightId && styles.highlight].filter(Boolean).join(' ')}
            >
              <div className={styles.main}>
                <div className={styles.head}>
                  <button
                    type="button"
                    className={`${styles.word} ${tile.stretched}`}
                    onClick={() => setOpenId(entry.id)}
                    aria-haspopup="dialog"
                    title="Открыть статью целиком"
                  >
                    {entry.word}
                  </button>
                  {entry.pronunciation && <span className={styles.pronunciation}>{entry.pronunciation}</span>}
                  {entry.audio && (
                    <span className={`${styles.audio} ${tile.above}`}>
                      <AudioPlayer audio={entry.audio} label={`Произношение: ${entry.word}`} compact />
                    </span>
                  )}
                </div>
                <p className={styles.translation}>{entry.translation}</p>
                {entry.examples?.[0] && (
                  <p className={styles.example}>
                    {entry.examples[0]}
                    {entry.examples.length > 1 && <span className={styles.more}> · ещё {entry.examples.length - 1}</span>}
                  </p>
                )}
              </div>
              <div className={styles.side}>
                <span className={styles.pos}>{POS_LABELS[entry.partOfSpeech] ?? entry.partOfSpeech}</span>
                {renderActions && <span className={`${styles.actions} ${tile.above}`}>{renderActions(entry)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <WordDetails entry={opened} onClose={() => setOpenId(null)} renderActions={renderActions} />
    </div>
  );
}
