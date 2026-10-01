/**
 * Оценка и реакция на уроке-превью у гостя без аккаунта: хранятся только
 * в этом браузере (localStorage) и никуда не отправляются.
 */
const STORAGE_KEY = 'polygloto.previewFeedback';

export const EMPTY_FEEDBACK = Object.freeze({ rating: null, reaction: null });

export function loadFeedback(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return {
      rating: saved?.rating === 'like' || saved?.rating === 'dislike' ? saved.rating : null,
      reaction: typeof saved?.reaction === 'string' ? saved.reaction : null,
    };
  } catch {
    return EMPTY_FEEDBACK;
  }
}

export function saveFeedback(feedback, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(feedback));
  } catch {
    // Приватный режим или запрет хранилища: оценка просто не запомнится.
  }
}

/** Повторное нажатие на тот же вариант снимает его, как в настоящих курсах. */
export function toggle(feedback, field, value) {
  return { ...feedback, [field]: feedback[field] === value ? null : value };
}

/** Счётчики для RatingControl и ReactionBar: на превью голосует только сам гость. */
export function counts(feedback) {
  return {
    likes: feedback.rating === 'like' ? 1 : 0,
    dislikes: feedback.rating === 'dislike' ? 1 : 0,
    reactions: { counts: feedback.reaction ? { [feedback.reaction]: 1 } : {}, mine: feedback.reaction },
  };
}
