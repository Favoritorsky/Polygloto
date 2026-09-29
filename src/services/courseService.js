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
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { COLLECTIONS, CONTENT_SUBCOLLECTIONS, COURSE_STATUS, LIMITS, RATE_LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';
import { deleteAllDocs } from './batchUtils.js';
import { deleteCommentInBatch } from './commentService.js';
import { stampRateLimit, withRateLimit } from './rateLimit.js';

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

/**
 * Создаёт черновик с первым уроком одной пакетной записью вместе с отметкой
 * rateLimits.createCourse: правила пропустят её не чаще раза в 30 с.
 */
export async function createCourse(uid, { title, language, description = '' }) {
  const ref = doc(collection(db, COLLECTIONS.COURSES));
  const lessonRef = doc(collection(ref, SUBCOLLECTIONS.LESSONS));
  const batch = writeBatch(db);
  batch.set(ref, {
    authorId: uid,
    title: title.trim(),
    language: language.trim(),
    description: description.trim(),
    categories: [],
    lessonOrder: [lessonRef.id],
    referenceOrder: [],
    status: COURSE_STATUS.DRAFT,
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Первый пустой урок, чтобы редактор сразу был готов к работе.
  batch.set(lessonRef, { title: 'Урок 1', blocks: [], updatedAt: serverTimestamp() });
  stampRateLimit(batch, uid, 'createCourse');
  await withRateLimit(uid, 'createCourse', RATE_LIMITS.CREATE_COURSE_SECONDS, () => batch.commit());
  return ref.id;
}

export function subscribeToCourse(courseId, onData, onError) {
  return onSnapshot(
    courseRef(courseId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

const millis = (value) => value?.toMillis?.() ?? 0;

/**
 * Курсы автора, свежие сверху. Сортировка на клиенте: запрос
 * «authorId + orderBy» потребовал бы составной индекс, а его ключ деплоя
 * создать не может.
 */
export function subscribeToMyCourses(uid, onData, onError) {
  const q = query(collection(db, COLLECTIONS.COURSES), where('authorId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const courses = snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      onData(courses.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt)));
    },
    onError,
  );
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

/**
 * Удаляет курс целиком. Без Cloud Functions каскад выполняет клиент, в
 * порядке, который разрешают правила: сначала обсуждение и реакции (их можно
 * прочитать, пока курс опубликован), затем опубликованный снимок, затем
 * рабочий контент и сам курс. Голоса читателей (ratings) клиент перечислить
 * не может — они приватны и остаются недоступными «сиротами».
 */
export async function deleteCourse(courseId) {
  const course = courseRef(courseId);
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  const isPublished = (await getDoc(publicRef)).exists();
  if (isPublished) {
    await deleteAllDocs(collection(course, SUBCOLLECTIONS.COMMENTS), deleteCommentInBatch);
    await deleteAllDocs(collection(course, SUBCOLLECTIONS.REACTIONS));
    for (const name of CONTENT_SUBCOLLECTIONS) await deleteAllDocs(collection(publicRef, name));
    await deleteDoc(publicRef);
  }
  for (const name of CONTENT_SUBCOLLECTIONS) await deleteAllDocs(collection(course, name));
  await deleteDoc(course);
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
