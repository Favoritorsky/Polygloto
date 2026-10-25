import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { LIMITS, normalizeText } from '../../../shared/schema.js';
import Avatar from '../../components/profile/Avatar.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { getCatalogLanguages } from '../../services/catalogService.js';
import {
  CHAT_PAGE,
  deleteChatMessage,
  findCourseForLanguage,
  sendChatMessage,
  subscribeToChat,
  validateChatMessage,
} from '../../services/chatService.js';
import { toUserMessage } from '../../services/errors.js';
import styles from './ChatPage.module.css';

function formatTime(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : 'только что';
}

function MessageForm({ language, courseId, author }) {
  const id = useId();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send(event) {
    event?.preventDefault();
    if (sending) return;
    const problem = validateChatMessage(text);
    if (problem) return setError(problem);
    setSending(true);
    setError('');
    // Сообщение появится по подписке раньше ответа сервера — поле очищаем сразу.
    const sent = text;
    setText('');
    try {
      await sendChatMessage(language, courseId, author, sent);
    } catch (err) {
      setText((current) => current || sent);
      setError(toUserMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} className={styles.form} noValidate>
      <label htmlFor={id} className="visually-hidden">
        Сообщение
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        maxLength={LIMITS.CHAT_MESSAGE_MAX}
        placeholder="Сообщение… (Ctrl+Enter — отправить)"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
        }}
      />
      <div className={styles.formFooter}>
        <span className={styles.muted}>
          {text.length}/{LIMITS.CHAT_MESSAGE_MAX}
        </span>
        <Button type="submit" size="sm" loading={sending}>
          Отправить
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </form>
  );
}

/** Комната чата одного языка: /chats/:language (languageLower), ?course= — курс, с которого пришли. */
export default function LanguageChatPage() {
  const params = useParams();
  const language = normalizeText(params.language);
  const [search] = useSearchParams();
  const { user, profile, isAdmin, isBanned } = useAuth();
  const [count, setCount] = useState(CHAT_PAGE);
  const [actionError, setActionError] = useState('');

  const languages = useAsync(getCatalogLanguages, 'languages');
  // Сообщение должно ссылаться на опубликованный курс этого языка (так правила проверяют, что язык есть на сайте).
  const fromCourse = search.get('course');
  const course = useAsync(
    async () => (fromCourse ? { id: fromCourse } : findCourseForLanguage(language)),
    `${language}/${fromCourse}`,
  );
  const messages = useSubscription((onData, onError) => subscribeToChat(language, count, onData, onError), `${language}/${count}`);

  const name = languages.data?.find((item) => item.key === language)?.name ?? params.language;
  const closed = course.data === null;

  // Новые сообщения — внизу: прокручиваем к ним, если читатель и так был внизу.
  const listRef = useRef(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

  async function handleDelete(message) {
    if (!window.confirm('Удалить сообщение?')) return;
    setActionError('');
    try {
      await deleteChatMessage(language, message.id);
    } catch (err) {
      setActionError(toUserMessage(err));
    }
  }

  return (
    <div className={styles.page}>
      <p className={styles.crumbs}>
        <Link to="/chats">Чаты языков</Link>
      </p>
      <h1>💬 {name}</h1>
      <p className={styles.intro}>
        Чат для всех, кто учит этот язык.{' '}
        <Link to={`/catalog?lang=${encodeURIComponent(language)}`}>Самоучители по языку</Link>
      </p>
      {closed && <Alert tone="info">Для этого языка пока нет опубликованных самоучителей — писать в чат нельзя.</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <AsyncState
        loading={messages.loading}
        error={messages.error}
        onRetry={messages.retry}
        empty={messages.data?.length === 0}
        emptyText="Сообщений пока нет — начните разговор."
      >
        <div
          ref={listRef}
          className={styles.messages}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {messages.data?.length === count && (
            <Button variant="secondary" size="sm" onClick={() => setCount((c) => c + CHAT_PAGE)}>
              Показать раньше
            </Button>
          )}
          <ul className={styles.list}>
            {messages.data?.map((m) => (
              <li key={m.id} className={m.authorId === user?.uid ? `${styles.message} ${styles.mine}` : styles.message}>
                <div className={styles.head}>
                  <Avatar name={m.authorName} seed={m.authorId} size={24} />
                  <Link to={`/users/${m.authorId}`} className={styles.author}>
                    {m.authorName}
                  </Link>
                  <time className={styles.muted}>{formatTime(m.createdAt)}</time>
                  {user && (m.authorId === user.uid || isAdmin) && (
                    <button type="button" className={styles.delete} onClick={() => handleDelete(m)}>
                      Удалить
                    </button>
                  )}
                </div>
                <p className={styles.text}>{m.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </AsyncState>
      {user && profile && !isBanned && !closed && (
        <MessageForm language={language} courseId={course.data?.id} author={{ uid: user.uid, displayName: profile.displayName }} />
      )}
      {!user && (
        <p className={styles.muted}>
          <Link to="/login">Войдите</Link> или <Link to="/register">зарегистрируйтесь</Link>, чтобы писать в чат.
        </p>
      )}
    </div>
  );
}
