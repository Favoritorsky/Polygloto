/**
 * Лёгкие эмодзи-реакции на уроки и комментарии (не путать с оценкой курса).
 * Одна реакция пользователя на цель: id документа = {uid}_{targetType}_{targetId}.
 */
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

const reactionsCol = (courseId) => collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.REACTIONS);

/**
 * Подписка на реакции для набора целей одного типа.
 * Возвращает Map targetId → { counts: {emoji: n}, mine: emoji|null } через onData.
 */
export function subscribeToReactions(courseId, targetType, targetIds, uid, onData, onError) {
  const ids = [...new Set(targetIds)].filter(Boolean);
  if (ids.length === 0) {
    onData(new Map());
    return () => {};
  }
  // Ограничение Firestore: не больше 30 значений в 'in' — делим на части.
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = new Map();
  const emit = () => {
    const summary = new Map(ids.map((id) => [id, { counts: {}, mine: null }]));
    for (const docs of results.values()) {
      for (const r of docs) {
        const entry = summary.get(r.targetId);
        if (!entry) continue;
        entry.counts[r.emoji] = (entry.counts[r.emoji] ?? 0) + 1;
        if (r.uid === uid) entry.mine = r.emoji;
      }
    }
    onData(summary);
  };
  const unsubscribers = chunks.map((chunk, index) =>
    onSnapshot(
      query(reactionsCol(courseId), where('targetType', '==', targetType), where('targetId', 'in', chunk)),
      (snap) => {
        results.set(index, snap.docs.map((d) => d.data()));
        if (results.size === chunks.length) emit();
      },
      onError,
    ),
  );
  return () => unsubscribers.forEach((u) => u());
}

/** Поставить реакцию; повторное нажатие той же — снять. */
export function toggleReaction(courseId, uid, targetType, targetId, emoji, current) {
  const ref = doc(reactionsCol(courseId), `${uid}_${targetType}_${targetId}`);
  if (current === emoji) return deleteDoc(ref);
  return setDoc(ref, { uid, targetType, targetId, emoji, createdAt: serverTimestamp() });
}
