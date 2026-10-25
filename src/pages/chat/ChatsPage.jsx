import { useState } from 'react';
import { chatPath } from '../../../shared/chat.js';
import { normalizeText } from '../../../shared/schema.js';
import AsyncState from '../../components/ui/AsyncState.jsx';
import CardLink from '../../components/ui/CardLink.jsx';
import tile from '../../components/ui/CardLink.module.css';
import { useAsync } from '../../hooks/useSubscription.js';
import { getCatalogLanguages } from '../../services/catalogService.js';
import styles from './ChatPage.module.css';

/** Список чатов: по одному на каждый язык (естественный или искусственный), у которого есть опубликованный самоучитель. */
export default function ChatsPage() {
  const languages = useAsync(getCatalogLanguages, 'languages');
  const [search, setSearch] = useState('');
  const needle = normalizeText(search);
  const items = (languages.data ?? []).filter((item) => !needle || normalizeText(item.name).includes(needle));

  return (
    <div className={styles.page}>
      <h1>Чаты языков</h1>
      <p className={styles.intro}>
        Общайтесь с теми, кто учит тот же язык: задавайте вопросы, практикуйтесь, делитесь находками. Чат есть у каждого языка, по
        которому на сайте опубликован хотя бы один самоучитель.
      </p>
      <label htmlFor="chat-search" className="visually-hidden">
        Поиск языка
      </label>
      <input
        id="chat-search"
        type="search"
        className={styles.search}
        placeholder="Найти язык"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <AsyncState
        loading={languages.loading}
        error={languages.error}
        onRetry={languages.retry}
        empty={items.length === 0}
        emptyText={needle ? 'Такого языка пока нет.' : 'Опубликованных курсов пока нет.'}
      >
        <ul className={styles.rooms}>
          {items.map((item) => (
            <li key={item.key} className={`${styles.room} ${tile.tile}`}>
              <CardLink to={chatPath(item.key)} className={styles.roomName}>
                💬 {item.name}
              </CardLink>
              <span className={styles.muted}>самоучителей: {item.count}</span>
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
