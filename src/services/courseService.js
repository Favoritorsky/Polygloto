/**
 * Рабочая версия курса (courses/{id}) и её разделы (уроки, справочник).
 * Опубликованные снимки — в publicCourseService.js.
 */
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CALLABLES, COLLECTIONS, COURSE_STATUS, LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, functions } from './firebase.js';

/** Вид раздела курса: уроки или справочник. */
export const SECTION_KINDS = Object.freeze({
  lessons: { collection: SUBCOLLECTIONS.LESSONS, orderField: 'lessonOrder', newTitle: 'Новый урок' },
  reference: { collection: SUBCOLLECTIONS.REFERENCE, orderField: 'referenceOrder', newTitle: 'Новый раздел' },
});

const courseRef = (courseId) => doc(db, COLLECTIONS.COURSES, courseId);
const sectionRef = (courseId, kind, id) => doc(db, COLLECTIONS.COURSES, courseId, SECTION_KINDS[kind].collection, id);

/** Клиентская валидация метаданных (дублирует правила и createCourse). */
export function validateCourseMeta({ title, language, description }) {
  const errors = {};
  const t = (title ?? '').trim();
  const l = (language ?? '').trim();
  if (t.length < LIMITS.COURSE_TITLE_MIN || t.length > LIMITS.COURSE_TITLE_MAX) {
    errors.title = `Название: от ${LIMITS.COURSE_TITLE_MIN} до ${LIMITS.COURSE_TITLE_MAX} символов.`;
  }
  if (l.length < LIMITS.COURSE_LANGUAGE_MIN || l.length > LIMITS.COURSE_LANGUAGE_MAX) {
    errors.language = `Язык: от ${LIMITS.COURSE_LANGUAGE_MIN} до ${LIMITS.COURSE_LANGUAGE_MAX} символов.`;
  }
  if ((description ?? '').length > LIMITS.COURSE_DESCRIPTION_MAX) {
    errors.description = `Описание: не больше ${LIMITS.COURSE_DESCRIPTION_MAX} символов.`;
  }
  return errors;
}

export async function createCourse({ title, language, description }) {
  const result = await httpsCallable(functions, CALLABLES.CREATE_COURSE)({ title, language, description });
  return result.data.courseId;
}

export function subscribeToCourse(courseId, onData, onError) {
  return onSnapshot(
    courseRef(courseId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export function subscribeToMyCourses(uid, onData, onError) {
  const q = query(collection(db, COLLECTIONS.COURSES), where('authorId', '==', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Сохраняет метаданные курса (только в статусе draft — см. правила). */
export function updateCourseMeta(courseId, patch) {
  const allowed = {};
  for (const key of ['title', 'language', 'description', 'categories']) {
    if (patch[key] !== undefined) allowed[key] = typeof patch[key] === 'string' ? patch[key].trim() : patch[key];
  }
  return updateDoc(courseRef(courseId), { ...allowed, updatedAt: serverTimestamp() });
}

/** Переводит опубликованный/отклонённый/отправленный курс обратно в черновик. */
export function returnToDraft(courseId) {
  return updateDoc(courseRef(courseId), { status: COURSE_STATUS.DRAFT, updatedAt: serverTimestamp() });
}

/** Отправка на модерацию. Правила требуют email_verified в токене. */
export function submitForReview(courseId) {
  return updateDoc(courseRef(courseId), {
    status: COURSE_STATUS.PENDING_REVIEW,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteCourse(courseId) {
  return deleteDoc(courseRef(courseId));
}

// ---------- Разделы (уроки / справочник) ----------

export function subscribeToSections(courseId, kind, onData, onError) {
  const col = collection(db, COLLECTIONS.COURSES, courseId, SECTION_KINDS[kind].collection);
  return onSnapshot(
    col,
    // Список нужен только для заголовков; контент открытого раздела грузится отдельно.
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, title: d.data().title }))),
    onError,
  );
}

export async function getSection(courseId, kind, id) {
  const snap = await getDoc(sectionRef(courseId, kind, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Создаёт раздел и добавляет его в порядок — атомарно одним пакетом. */
export async function createSection(courseId, kind) {
  const { collection: col, orderField, newTitle } = SECTION_KINDS[kind];
  const ref = doc(collection(db, COLLECTIONS.COURSES, courseId, col));
  const batch = writeBatch(db);
  batch.set(ref, { title: newTitle, blocks: [], updatedAt: serverTimestamp() });
  batch.update(courseRef(courseId), { [orderField]: arrayUnion(ref.id), updatedAt: serverTimestamp() });
  await batch.commit();
  return ref.id;
}

export function saveSection(courseId, kind, id, { title, blocks }) {
  return updateDoc(sectionRef(courseId, kind, id), { title, blocks, updatedAt: serverTimestamp() });
}

export async function deleteSection(courseId, kind, id) {
  const batch = writeBatch(db);
  batch.delete(sectionRef(courseId, kind, id));
  batch.update(courseRef(courseId), {
    [SECTION_KINDS[kind].orderField]: arrayRemove(id),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export function reorderSections(courseId, kind, order) {
  return updateDoc(courseRef(courseId), { [SECTION_KINDS[kind].orderField]: order, updatedAt: serverTimestamp() });
}
