/**
 * Очки, серия дней, ежедневные задания и рейтинг (v2). userStats/{uid}
 * пишется только внутри транзакции вместе с событием (см. shared/gamification.js
 * и firestore.rules). Если правила отклонят запись статистики (например, часы
 * устройства сильно расходятся с сервером около полуночи UTC), само действие
 * всё равно выполняется — без очков.
 */
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { applyStatsEvent, dayIndex, weekIndex } from '../../shared/gamification.js';
import { COLLECTIONS, USER_SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

export const STATS_CHANGED_EVENT = 'polygloto:stats-changed';

export const statsRef = (uid) => doc(db, COLLECTIONS.USER_STATS, uid);
const entryRef = (week, uid) => doc(db, COLLECTIONS.LEADERBOARDS, String(week), 'entries', uid);

/**
 * Добавляет в транзакцию обновление статистики. statsSnap — tx.get(statsRef(uid)),
 * прочитанный до записей. Возвращает новое состояние.
 */
export function addStatsEvent(tx, uid, statsSnap, type, eventId, detail = {}) {
  const previous = statsSnap.exists() ? statsSnap.data() : null;
  const next = applyStatsEvent(previous, type, detail, Date.now());
  tx.set(statsRef(uid), { ...next, lastEvent: type, lastEventId: eventId, updatedAt: serverTimestamp() });
  if (next.weekPoints > 0 && next.weekPoints !== (previous?.weekIndex === next.weekIndex ? previous.weekPoints : 0)) {
    tx.set(entryRef(next.weekIndex, uid), { points: next.weekPoints });
  }
  return next;
}

/** Выполняет действие со статистикой, а при отказе правил — без неё. */
export async function withStats(runWithStats, runWithout) {
  try {
    const result = await runWithStats();
    window.dispatchEvent(new Event(STATS_CHANGED_EVENT));
    return result;
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error;
    return runWithout();
  }
}

export function subscribeToStats(uid, onData, onError) {
  return onSnapshot(statsRef(uid), (snap) => onData(snap.exists() ? snap.data() : null), onError);
}

export async function getStats(uid) {
  const snap = await getDoc(statsRef(uid));
  return snap.exists() ? snap.data() : null;
}

/** Номер текущей недели (UTC). */
export function currentWeek(nowMs = Date.now()) {
  return weekIndex(dayIndex(nowMs));
}

const TOP = 20;

/** Рейтинг недели: [{ uid, points }], по убыванию очков. */
export async function loadWeeklyLeaderboard(week = currentWeek()) {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.LEADERBOARDS, String(week), 'entries'), orderBy('points', 'desc'), limit(TOP)),
  );
  return snap.docs.map((d) => ({ uid: d.id, points: d.data().points }));
}

/** Рейтинг за всё время: [{ uid, points }]. */
export async function loadAllTimeLeaderboard() {
  const snap = await getDocs(query(collection(db, COLLECTIONS.USER_STATS), orderBy('points', 'desc'), limit(TOP)));
  return snap.docs.map((d) => ({ uid: d.id, points: d.data().points })).filter((e) => e.points > 0);
}

/** Имена участников рейтинга из профилей (актуальные, без копий в рейтинге). */
export async function loadDisplayNames(uids) {
  const docs = await Promise.all(uids.map((uid) => getDoc(doc(db, COLLECTIONS.USERS, uid)).catch(() => null)));
  return new Map(uids.map((uid, i) => [uid, docs[i]?.exists() ? docs[i].data().displayName : null]));
}

/** Отметка «курс пройден» (для значков), если её ещё нет. */
export async function markCourseCompleted(uid, courseId) {
  const ref = doc(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.COMPLETED_COURSES, courseId);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(ref, { completedAt: serverTimestamp() });
  return true;
}

export async function countCompletedCourses(uid) {
  return (await getCountFromServer(collection(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.COMPLETED_COURSES))).data().count;
}
