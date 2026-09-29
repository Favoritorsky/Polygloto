import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LIMITS } from '../../../shared/schema.js';
import Avatar from '../../components/profile/Avatar.jsx';
import ReactionBar from '../../components/reactions/ReactionBar.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useReactions } from '../../hooks/useReactions.js';
import { useSubscription } from '../../hooks/useSubscription.js';
import { COMMENTS_PAGE, addComment, deleteComment, subscribeToComments, validateComment } from '../../services/commentService.js';
import { toUserMessage } from '../../services/errors.js';
import { toggleReaction } from '../../services/reactionService.js';
import { useCoursePage } from './coursePageContext.js';
import styles from './CommentsSection.module.css';

function formatDate(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : 'только что';
}

function CommentForm({ courseId }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const problem = validateComment(text);
    if (problem) return setError(problem);
    setSubmitting(true);
    setError('');
    // Очищаем сразу: комментарий появится в списке по подписке раньше ответа
    // функции, и сброс после ответа стёр бы уже начатый следующий текст.
    const sent = text;
    setText('');
    try {
      await addComment(courseId, sent);
    } catch (err) {
      setText((current) => current || sent);
      setError(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <label htmlFor="comment-text" className="visually-hidden">
        Комментарий
      </label>
      <textarea
        id="comment-text"
        rows={3}
        value={text}
        maxLength={LIMITS.COMMENT_MAX}
        onChange={(e) => setText(e.target.value)}
        placeholder="Поделитесь впечатлениями или задайте вопрос автору"
      />
      <div className={styles.formFooter}>
        <span className={styles.counter}>
          {text.length}/{LIMITS.COMMENT_MAX}
        </span>
        <Button type="submit" size="sm" loading={submitting}>
          Отправить
        </Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
    </form>
  );
}

/** Обсуждение курса: комментарии с реакциями, удаление своих (и модерация автором курса/админом). */
export default function CommentsSection() {
  const { course } = useCoursePage();
  const { user, isAdmin, isBanned } = useAuth();
  const [count, setCount] = useState(COMMENTS_PAGE);
  const [actionError, setActionError] = useState('');
  const comments = useSubscription(
    (onData, onError) => subscribeToComments(course.id, count, onData, onError),
    `${course.id}/${count}`,
  );
  const ids = (comments.data ?? []).map((c) => c.id);
  const reactions = useReactions(course.id, 'comment', ids, user?.uid);

  async function handleDelete(comment) {
    if (!window.confirm('Удалить комментарий?')) return;
    setActionError('');
    try {
      await deleteComment(course.id, comment.id);
    } catch (err) {
      setActionError(toUserMessage(err));
    }
  }

  async function handleReaction(comment, emoji) {
    setActionError('');
    try {
      await toggleReaction(course.id, user.uid, 'comment', comment.id, emoji, reactions.data.get(comment.id)?.mine);
    } catch (err) {
      setActionError(toUserMessage(err));
    }
  }

  const canModerate = (comment) => user && (comment.authorId === user.uid || course.authorId === user.uid || isAdmin);

  return (
    <section className={styles.wrap}>
      {user && !isBanned && <CommentForm courseId={course.id} />}
      {!user && (
        <p className={styles.muted}>
          <Link to="/login">Войдите</Link> или <Link to="/register">зарегистрируйтесь</Link>, чтобы оставить комментарий.
        </p>
      )}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      <AsyncState
        loading={comments.loading}
        error={comments.error}
        onRetry={comments.retry}
        empty={comments.data?.length === 0}
        emptyText="Комментариев пока нет — будьте первым."
      >
        <ul className={styles.list}>
          {comments.data?.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <div className={styles.head}>
                <Avatar name={comment.authorName} url={comment.authorPhotoURL} seed={comment.authorId} size={28} />
                <Link to={`/users/${comment.authorId}`} className={styles.author}>
                  {comment.authorName}
                </Link>
                {comment.authorId === course.authorId && <span className={styles.badge}>автор курса</span>}
                <time className={styles.date}>{formatDate(comment.createdAt)}</time>
                {canModerate(comment) && (
                  <button type="button" className={styles.delete} onClick={() => handleDelete(comment)}>
                    Удалить
                  </button>
                )}
              </div>
              <p className={styles.text}>{comment.text}</p>
              <ReactionBar
                summary={reactions.data.get(comment.id)}
                onToggle={user && !isBanned ? (emoji) => handleReaction(comment, emoji) : undefined}
                disabledReason="Войдите, чтобы отреагировать"
              />
            </li>
          ))}
        </ul>
        {comments.data?.length === count && (
          <Button variant="secondary" onClick={() => setCount((c) => c + COMMENTS_PAGE)}>
            Показать ещё
          </Button>
        )}
      </AsyncState>
    </section>
  );
}
