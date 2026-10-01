/**
 * Статистика заданий (v2). Первая попытка читателя записывается отметкой
 * users/{uid}/taskResults/{courseId_lessonId_taskId} и одновременно
 * увеличивает сумму publicCourses/{courseId}/taskStats/{lessonId_taskId}.
 * Повторные попытки ничего не пишут. Автор видит только суммы.
 */
import { collection, doc, getDoc, getDocs, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { COLLECTIONS, SUBCOLLECTIONS, USER_SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

/** Минимум ответов, с которого автору показывается процент ошибок. */
export const STATS_MIN_ATTEMPTS = 5;

export const TASK_RESULT_EVENT = 'polygloto:task-result';

const recorded = new Set();

export function taskResultId(courseId, lessonId, taskId) {
  return `${courseId}_${lessonId}_${taskId}`;
}

/**
 * Записывает первую попытку. Возвращает true, если это была первая попытка
 * (и статистика увеличена), false — если отметка уже есть.
 */
export async function recordFirstAttempt(uid, { courseId, lessonId, taskId, blockIndex, correct }) {
  const id = taskResultId(courseId, lessonId, taskId);
  const key = `${uid}/${id}`;
  if (recorded.has(key)) return false;
  recorded.add(key);
  const markerRef = doc(db, COLLECTIONS.USERS, uid, USER_SUBCOLLECTIONS.TASK_RESULTS, id);
  const statRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId, SUBCOLLECTIONS.TASK_STATS, `${lessonId}_${taskId}`);
  try {
    const first = await runTransaction(db, async (tx) => {
      const marker = await tx.get(markerRef);
      if (marker.exists()) return false;
      tx.set(markerRef, { courseId, lessonId, taskId, blockIndex, correct, createdAt: serverTimestamp() });
      tx.set(statRef, { lessonId, taskId, attempts: increment(1), wrong: increment(correct ? 0 : 1) }, { merge: true });
      return true;
    });
    if (first) window.dispatchEvent(new CustomEvent(TASK_RESULT_EVENT, { detail: { courseId, lessonId, taskId, correct } }));
    return first;
  } catch (error) {
    recorded.delete(key);
    throw error;
  }
}

/** Суммы по заданиям курса: Map(`${lessonId}_${taskId}` → { attempts, wrong }). Только автору и админу. */
export async function loadTaskStats(courseId) {
  const snap = await getDocs(collection(db, COLLECTIONS.PUBLIC_COURSES, courseId, SUBCOLLECTIONS.TASK_STATS));
  return new Map(snap.docs.map((d) => [d.id, { attempts: d.data().attempts ?? 0, wrong: d.data().wrong ?? 0 }]));
}

/**
 * Для вкладки «Статистика»: задания опубликованных уроков по порядку и суммы.
 * Возвращает [{ lessonId, title, tasks: [{ id, taskType, data, attempts, wrong }] }].
 */
export async function loadCourseTaskStats(courseId) {
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  const [course, lessons, stats] = await Promise.all([
    getDoc(publicRef),
    getDocs(collection(publicRef, SUBCOLLECTIONS.LESSONS)),
    loadTaskStats(courseId),
  ]);
  if (!course.exists()) return [];
  const byId = new Map(lessons.docs.map((d) => [d.id, d.data()]));
  return (course.data().lessonOrder ?? [])
    .filter((id) => byId.has(id))
    .map((lessonId) => {
      const lesson = byId.get(lessonId);
      const tasks = (lesson.blocks ?? [])
        .filter((b) => b.type === 'task' && b.id)
        .map((b) => ({
          id: b.id,
          taskType: b.taskType,
          data: b.data ?? {},
          ...(stats.get(`${lessonId}_${b.id}`) ?? { attempts: 0, wrong: 0 }),
        }));
      return { lessonId, title: lesson.title, tasks };
    })
    .filter((l) => l.tasks.length > 0);
}
