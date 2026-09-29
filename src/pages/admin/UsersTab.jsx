import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAsync } from '../../hooks/useSubscription.js';
import { toUserMessage } from '../../services/errors.js';
import { searchUsers, setUserBan } from '../../services/moderationService.js';
import styles from './AdminList.module.css';

const ROLE_LABELS = { reader: 'Читатель', user: 'Автор', admin: 'Админ' };

export default function UsersTab() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState('');

  // Debounce поиска, чтобы не слать запрос на каждую букву.
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 400);
    return () => clearTimeout(t);
  }, [input]);

  const { data: users, loading, error, retry, setData } = useAsync(() => searchUsers(search), `users:${search}`);

  async function toggleBan(user) {
    const next = !user.banned;
    if (next && !window.confirm(`Заблокировать «${user.displayName}»? Пользователь не сможет создавать и менять контент.`)) return;
    setBusy(user.id);
    setActionError('');
    try {
      await setUserBan(user.id, next);
      setData(users.map((u) => (u.id === user.id ? { ...u, banned: next } : u)));
    } catch (err) {
      setActionError(toUserMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <input
        className={styles.search}
        type="search"
        placeholder="Начало имени (с учётом регистра)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        aria-label="Поиск пользователя"
      />
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <AsyncState loading={loading} error={error} onRetry={retry} empty={users?.length === 0} emptyText="Никого не найдено.">
        <ul className={styles.list}>
          {users?.map((user) => (
            <li key={user.id} className={styles.item}>
              <div className={styles.main}>
                <Link to={`/users/${user.id}`} className={styles.title}>
                  {user.displayName}
                </Link>
                <div className={styles.meta}>
                  <span>{ROLE_LABELS[user.role] ?? user.role}</span>
                </div>
              </div>
              {user.banned && <Badge tone="negative">Заблокирован</Badge>}
              {user.role !== 'admin' && (
                <Button variant={user.banned ? 'secondary' : 'danger'} size="sm" loading={busy === user.id} onClick={() => toggleBan(user)}>
                  {user.banned ? 'Разблокировать' : 'Заблокировать'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </AsyncState>
    </div>
  );
}
