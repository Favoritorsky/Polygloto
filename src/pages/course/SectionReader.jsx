import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContentRenderer from '../../components/content/ContentRenderer.jsx';
import ReactionBar from '../../components/reactions/ReactionBar.jsx';
import Alert from '../../components/ui/Alert.jsx';
import AsyncState from '../../components/ui/AsyncState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useReactions } from '../../hooks/useReactions.js';
import { useAsync, useSubscription } from '../../hooks/useSubscription.js';
import { toUserMessage } from '../../services/errors.js';
import { getPublicSection } from '../../services/publicCourseService.js';
import { subscribeToLessonProgress } from '../../services/srsService.js';
import { toggleReaction } from '../../services/reactionService.js';
import { useCoursePage } from './coursePageContext.js';
import LessonComplete from './LessonComplete.jsx';
import styles from './SectionReader.module.css';

const PARAM = { lessons: 'lesson', reference: 'section' };

/** Чтение уроков / справочника: оглавление, контент, навигация, реакции на урок. */
export default function SectionReader({ kind }) {
  const { course, dictionary, review } = useCoursePage();
  const { user, isBanned } = useAuth();
  const [params, setParams] = useSearchParams();
  const [reactionError, setReactionError] = useState('');
  const toc = course.toc?.[kind] ?? [];
  const order = kind === 'lessons' ? course.lessonOrder : course.referenceOrder;
  const items = (order ?? []).map((id) => toc.find((t) => t.id === id)).filter(Boolean);
  const requested = params.get(PARAM[kind]);
  const index = Math.max(0, items.findIndex((i) => i.id === requested));
  const current = items[index] ?? null;

  const select = useCallback(
    (id) => {
      const next = new URLSearchParams(params);
      next.set(PARAM[kind], id);
      setParams(next);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [params, setParams, kind],
  );

  // Ключ включает updatedAt: после одобрения новой версии урок перечитывается.
  const section = useAsync(
    () => getPublicSection(course.id, kind, current.id),
    current ? `${course.id}/${kind}/${current.id}/${course.updatedAt?.toMillis?.() ?? ''}` : null,
  );
  const progress = useSubscription(
    (onData, onError) => subscribeToLessonProgress(user.uid, course.id, onData, onError),
    kind === 'lessons' && user ? `${user.uid}/${course.id}` : null,
  );
  const completed = progress.data ?? new Set();
  const reactions = useReactions(course.id, 'lesson', kind === 'lessons' && current ? [current.id] : [], user?.uid);

  async function handleReaction(emoji) {
    setReactionError('');
    try {
      await toggleReaction(course.id, user.uid, 'lesson', current.id, emoji, reactions.data.get(current.id)?.mine);
    } catch (err) {
      setReactionError(toUserMessage(err));
    }
  }

  if (items.length === 0) {
    return <p className={styles.muted}>{kind === 'lessons' ? 'В курсе пока нет уроков.' : 'Справочник пуст.'}</p>;
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label={kind === 'lessons' ? 'Уроки' : 'Разделы справочника'}>
        <ol>
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.id === current?.id ? styles.active : undefined}
                aria-current={item.id === current?.id ? 'page' : undefined}
                onClick={() => select(item.id)}
              >
                <span className={styles.number}>{i + 1}.</span> {item.title || 'Без названия'}
                {completed.has(item.id) && (
                  <span className={styles.check} aria-label="пройден" title="Урок пройден">
                    ✓
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <article className={styles.article}>
        <h2 className={styles.title}>{current.title || 'Без названия'}</h2>
        <AsyncState loading={section.loading} error={section.error} onRetry={section.retry} empty={section.data === null} emptyText="Раздел не найден.">
          {section.data && (
            <ContentRenderer
              blocks={section.data.blocks}
              categories={course.categories}
              dictionary={dictionary.index}
              courseId={course.id}
              review={review}
            />
          )}
        </AsyncState>
        {kind === 'lessons' && section.data && !dictionary.loading && (
          <LessonComplete
            uid={user?.uid}
            courseId={course.id}
            lessonId={current.id}
            blocks={section.data.blocks}
            dictionaryIndex={dictionary.index}
            completed={completed.has(current.id)}
          />
        )}
        {kind === 'lessons' && (
          <div className={styles.reactions}>
            <ReactionBar
              summary={reactions.data.get(current.id)}
              onToggle={user && !isBanned ? handleReaction : undefined}
              disabledReason="Войдите, чтобы отреагировать"
            />
            {reactionError && <Alert tone="error">{reactionError}</Alert>}
          </div>
        )}
        <div className={styles.pager}>
          {index > 0 ? (
            <Button variant="secondary" onClick={() => select(items[index - 1].id)}>
              ← {items[index - 1].title || 'Назад'}
            </Button>
          ) : (
            <span />
          )}
          {index < items.length - 1 && <Button onClick={() => select(items[index + 1].id)}>{items[index + 1].title || 'Далее'} →</Button>}
        </div>
      </article>
    </div>
  );
}
