/**
 * Интервальные повторения: личные карточки users/{uid}/srsCards и пройденные
 * уроки users/{uid}/lessonProgress. Алгоритм — shared/srs.js, проверка формы
 * записи — firestore.rules.
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, USER_SUBCOLLECTIONS } from '../../shared/schema.js';
import { newCardState, reviewCard as nextState, srsCardId } from '../../shared/srs.js';
import { BATCH_SIZE } from './batchUtils.js';
import { db } from './firebase.js';
import { addStatsEvent, statsRef, withStats } from './gamificationService.js';

const cardsCol = (uid) => collection(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.SRS_CARDS);
const progressRef = (uid, courseId, lessonId) =>
  doc(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.LESSON_PROGRESS, `${courseId}_${lessonId}`);

/** Событие для счётчика в шапке: карточки добавлены или повторены. */
export const SRS_CHANGED_EVENT = 'polygloto:srs-changed';
const notify = () => window.dispatchEvent(new Event(SRS_CHANGED_EVENT));

function cardData(courseId, entry) {
  return {
    courseId,
    wordId: entry.id,
    word: entry.word,
    translation: entry.translation,
    ...newCardState(),
    dueAt: serverTimestamp(),
    lastReviewedAt: null,
    createdAt: serverTimestamp(),
  };
}

/** id слов курса, которые уже есть в повторении. */
async function existingWordIds(uid, courseId) {
  const snap = await getDocs(query(cardsCol(uid), where('courseId', '==', courseId)));
  return new Set(snap.docs.map((d) => d.data().wordId));
}

/**
 * Добавляет слова опубликованного курса в повторение (уже добавленные пропускает).
 * Возвращает число новых карточек. extra(batch) — дополнительные записи той же пачки.
 */
export async function addWordsToReview(uid, courseId, entries, extra) {
  const have = await existingWordIds(uid, courseId);
  const fresh = entries.filter((e) => !have.has(e.id));
  const chunks = [];
  for (let i = 0; i < fresh.length; i += BATCH_SIZE) chunks.push(fresh.slice(i, i + BATCH_SIZE));
  if (chunks.length === 0 && extra) chunks.push([]);
  for (const [i, chunk] of chunks.entries()) {
    const batch = writeBatch(db);
    chunk.forEach((entry) => batch.set(doc(cardsCol(uid), srsCardId(courseId, entry.id)), cardData(courseId, entry)));
    if (i === 0) extra?.(batch);
    await batch.commit();
  }
  if (fresh.length) notify();
  return fresh.length;
}

export async function isLessonCompleted(uid, courseId, lessonId) {
  return (await getDoc(progressRef(uid, courseId, lessonId))).exists();
}

/**
 * Отмечает урок пройденным (первый раз — с очками за урок) и добавляет его
 * слова в повторение.
 */
export async function completeLesson(uid, courseId, lessonId, entries) {
  const ref = progressRef(uid, courseId, lessonId);
  const mark = (withPoints) =>
    runTransaction(db, async (tx) => {
      const progress = await tx.get(ref);
      const stats = withPoints ? await tx.get(statsRef(uid)) : null;
      if (progress.exists()) return false;
      tx.set(ref, { courseId, lessonId, completedAt: serverTimestamp() });
      if (withPoints) addStatsEvent(tx, uid, stats, 'lesson', ref.id);
      return true;
    });
  const firstTime = await withStats(
    () => mark(true),
    () => mark(false),
  );
  const added = await addWordsToReview(uid, courseId, entries);
  return { added, alreadyCompleted: !firstTime };
}

/** Пройденные уроки читателя (для отметок в оглавлении). */
export function subscribeToLessonProgress(uid, courseId, onData, onError) {
  const q = query(collection(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.LESSON_PROGRESS), where('courseId', '==', courseId));
  return onSnapshot(q, (snap) => onData(new Set(snap.docs.map((d) => d.data().lessonId))), onError);
}

const dueQuery = (uid, now = Timestamp.now()) => query(cardsCol(uid), where('dueAt', '<=', now), orderBy('dueAt'));

/** Карточки к повторению (срок наступил), самые просроченные первыми. */
export async function loadDueCards(uid) {
  const snap = await getDocs(dueQuery(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function countDueCards(uid) {
  return (await getCountFromServer(dueQuery(uid))).data().count;
}

export async function countAllCards(uid) {
  return (await getCountFromServer(cardsCol(uid))).data().count;
}

/** Ближайший срок среди ещё не наступивших (для пустого состояния). */
export async function nextDueDate(uid) {
  const snap = await getDocs(query(cardsCol(uid), where('dueAt', '>', Timestamp.now()), orderBy('dueAt')));
  return snap.docs[0]?.data().dueAt?.toDate() ?? null;
}

/** Запись оценки. Возвращает новое состояние карточки. */
export async function submitReview(uid, card, grade) {
  const { dueMinutes, ...state } = nextState(card, grade);
  const update = {
    ...state,
    dueAt: Timestamp.fromMillis(Date.now() + dueMinutes * 60000),
    lastReviewedAt: serverTimestamp(),
  };
  const ref = doc(cardsCol(uid), card.id);
  // Очки — только если карточку уже повторяли и вспомнили (см. shared/gamification.js).
  const scored = card.lastReviewedAt != null && state.interval >= 1;
  const write = (withPoints) =>
    runTransaction(db, async (tx) => {
      const stats = withPoints ? await tx.get(statsRef(uid)) : null;
      tx.update(ref, update);
      if (withPoints) addStatsEvent(tx, uid, stats, 'review', card.id, { scored });
    });
  await withStats(
    () => write(true),
    () => write(false),
  );
  notify();
  return update;
}

export async function removeCard(uid, cardId) {
  await deleteDoc(doc(cardsCol(uid), cardId));
  notify();
}

/** id слов курса в повторении — для кнопок «В повторение» в словаре. */
export function subscribeToCourseCards(uid, courseId, onData, onError) {
  return onSnapshot(
    query(cardsCol(uid), where('courseId', '==', courseId)),
    (snap) => onData(new Set(snap.docs.map((d) => d.data().wordId))),
    onError,
  );
}
