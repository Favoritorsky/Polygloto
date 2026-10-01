/**
 * Админ-панель: очередь модерации, решения, пользователи.
 * Без Cloud Functions решение записывает браузер админа, а правила
 * пропускают такие записи только от пользователя с ролью admin и только
 * для курса на проверке. Контент очищается теми же функциями shared/, что
 * раньше выполнялись на сервере, поэтому публикуется ровно то, что модератор видел.
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAt,
  endAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { CATALOG_LANGUAGES_DOC, COLLECTIONS, CONTENT_SUBCOLLECTIONS, COURSE_STATUS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { collectAudioIds, isValidAudioDataUrl } from '../../shared/audio.js';
import { buildPublicSnapshot } from '../../shared/publicSnapshot.js';
import { BATCH_SIZE } from './batchUtils.js';
import { UserFacingError } from './errors.js';
import { db } from './firebase.js';

const millis = (value) => value?.toMillis?.() ?? 0;

/** Очередь проверки, старые заявки первыми (сортировка на клиенте — без составного индекса). */
export function subscribeToReviewQueue(onData, onError) {
  const q = query(collection(db, COLLECTIONS.COURSES), where('status', '==', COURSE_STATUS.PENDING_REVIEW));
  return onSnapshot(
    q,
    (snap) => {
      const courses = snap.docs.map((d) => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' }),
      }));
      onData(courses.sort((a, b) => millis(a.submittedAt) - millis(b.submittedAt)));
    },
    onError,
  );
}

export function subscribeToAllCourses(onData, onError) {
  const q = query(collection(db, COLLECTIONS.COURSES), orderBy('updatedAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

/** Весь контент рабочей версии для просмотра модератором. */
/**
 * Содержимое курса для проверки — в том виде, в каком оно будет опубликовано:
 * через ту же очистку, что и в moderateCourse. Черновик пишет автор напрямую,
 * поэтому сырые данные могут быть испорчены (намеренно или нет) — модератор
 * их не рендерит.
 */
export async function loadCourseContent(courseId, course) {
  const read = async (name) => {
    const snap = await getDocs(collection(db, COLLECTIONS.COURSES, courseId, name));
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  };
  const [lessons, reference, dictionary] = await Promise.all([
    read(SUBCOLLECTIONS.LESSONS),
    read(SUBCOLLECTIONS.REFERENCE),
    read(SUBCOLLECTIONS.DICTIONARY),
  ]);
  const snapshot = buildPublicSnapshot({
    course,
    author: null,
    lessons,
    reference,
    dictionary,
  });
  const ordered = (sections, order) => {
    const byId = new Map(sections.map((s) => [s.id, { id: s.id, ...s.data }]));
    return order.map((id) => byId.get(id));
  };
  return {
    categories: snapshot.meta.categories,
    lessons: ordered(snapshot.lessons, snapshot.meta.lessonOrder),
    reference: ordered(snapshot.reference, snapshot.meta.referenceOrder),
    dictionary: snapshot.dictionary.map(({ id, data }) => ({ id, ...data })),
  };
}

/** Пишет подколлекции снимка: удаляет устаревшие документы и записывает новые. */
async function writeSnapshotSections(publicRef, snapshot) {
  const sections = {
    [SUBCOLLECTIONS.LESSONS]: snapshot.lessons,
    [SUBCOLLECTIONS.REFERENCE]: snapshot.reference,
    [SUBCOLLECTIONS.DICTIONARY]: snapshot.dictionary,
  };
  const ops = [];
  for (const name of CONTENT_SUBCOLLECTIONS) {
    const target = collection(publicRef, name);
    const keep = new Set(sections[name].map((d) => d.id));
    const existing = await getDocs(target);
    existing.docs.filter((d) => !keep.has(d.id)).forEach((d) => ops.push((b) => b.delete(d.ref)));
    sections[name].forEach(({ id, data }) => ops.push((b) => b.set(doc(target, id), data)));
  }
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    ops.slice(i, i + BATCH_SIZE).forEach((op) => op(batch));
    await batch.commit();
  }
}

/**
 * Копирует в снимок только те аудиофайлы, на которые ссылается опубликованный
 * контент, и удаляет из снимка больше не нужные. Файлы по одному: каждый — до
 * полумегабайта, пакет таких записей упёрся бы в лимит размера запроса.
 */
async function copySnapshotAudio(courseRef, publicRef, snapshot) {
  const ids = collectAudioIds([snapshot.lessons, snapshot.reference, snapshot.dictionary]);
  const target = collection(publicRef, SUBCOLLECTIONS.AUDIO);
  const existing = await getDocs(target);
  const present = new Set(existing.docs.map((d) => d.id));
  for (const d of existing.docs) if (!ids.has(d.id)) await deleteDoc(d.ref);
  for (const id of ids) {
    if (present.has(id)) continue; // файлы не меняются (update запрещён), копировать заново не нужно
    const source = await getDoc(doc(courseRef, SUBCOLLECTIONS.AUDIO, id));
    if (source.exists() && isValidAudioDataUrl(source.data().dataUrl)) {
      await setDoc(doc(target, id), { dataUrl: source.data().dataUrl });
    }
  }
}

/** Новые значения счётчиков языков каталога после публикации курса. */
async function languageCounts(courseId, previous, meta) {
  const count = async (key) =>
    (await getCountFromServer(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('languageLower', '==', key)))).data().count;
  const result = new Map();
  const wasSame = previous?.languageLower === meta.languageLower;
  result.set(meta.languageLower, {
    name: meta.language,
    count: (await count(meta.languageLower)) + (wasSame ? 0 : 1),
  });
  if (previous?.languageLower && !wasSame) {
    result.set(previous.languageLower, {
      name: previous.language,
      count: Math.max(0, (await count(previous.languageLower)) - 1),
    });
  }
  return result;
}

/**
 * Одобрение: контент снимка пишется заранее (читатели прежней версии видят его
 * в той же структуре), а метаданные снимка, статус курса и список языков —
 * одной транзакцией, только если курс всё ещё на проверке и не был переотправлен.
 */
export async function approveCourse(courseId, moderatorId) {
  const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  const metaRef = doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC);

  const courseSnap = await getDoc(courseRef);
  if (!courseSnap.exists()) throw new UserFacingError('Курс удалён.');
  const course = courseSnap.data();
  if (course.status !== COURSE_STATUS.PENDING_REVIEW) throw new UserFacingError('Курс уже не на проверке.');
  const submittedAt = course.submittedAt?.toMillis?.() ?? null;

  const read = async (name) =>
    (await getDocs(collection(courseRef, name))).docs.map((d) => ({
      id: d.id,
      data: d.data(),
    }));
  const [lessons, reference, dictionary, authorSnap, previousSnap] = await Promise.all([
    read(SUBCOLLECTIONS.LESSONS),
    read(SUBCOLLECTIONS.REFERENCE),
    read(SUBCOLLECTIONS.DICTIONARY),
    getDoc(doc(db, COLLECTIONS.USERS, course.authorId)),
    getDoc(publicRef),
  ]);
  const snapshot = buildPublicSnapshot({
    course,
    author: authorSnap.data(),
    lessons,
    reference,
    dictionary,
  });
  const previous = previousSnap.exists() ? previousSnap.data() : null;

  await writeSnapshotSections(publicRef, snapshot);
  await copySnapshotAudio(courseRef, publicRef, snapshot);
  const counts = await languageCounts(courseId, previous, snapshot.meta);

  await runTransaction(db, async (tx) => {
    const [fresh, current, metaSnap] = await Promise.all([tx.get(courseRef), tx.get(publicRef), tx.get(metaRef)]);
    if (!fresh.exists()) throw new UserFacingError('Курс удалён.');
    const freshSubmitted = fresh.data().submittedAt?.toMillis?.() ?? null;
    if (fresh.data().status !== COURSE_STATUS.PENDING_REVIEW || freshSubmitted !== submittedAt) {
      throw new UserFacingError('Автор изменил курс во время проверки. Обновите страницу.');
    }
    // Счётчики оценок сохраняются между версиями; для первой публикации — нули.
    const counters = current.exists()
      ? {}
      : {
          likesCount: 0,
          dislikesCount: 0,
          score: 0,
          publishedAt: serverTimestamp(),
        };
    tx.set(
      publicRef,
      {
        ...snapshot.meta,
        ...counters,
        updatedAt: serverTimestamp(),
        approvedAt: serverTimestamp(),
        approvedBy: moderatorId,
      },
      { merge: true },
    );
    tx.update(courseRef, {
      status: COURSE_STATUS.PUBLISHED,
      rejectionReason: null,
      hasPublishedVersion: true,
      updatedAt: serverTimestamp(),
    });
    const items = new Map((metaSnap.exists() ? (metaSnap.data().items ?? []) : []).map((i) => [i.key, i]));
    for (const [key, { name, count }] of counts) {
      if (count > 0) items.set(key, { key, name, count });
      else items.delete(key);
    }
    tx.set(metaRef, {
      items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    });
  });
}

export async function rejectCourse(courseId, reason) {
  await updateDoc(doc(db, COLLECTIONS.COURSES, courseId), {
    status: COURSE_STATUS.REJECTED,
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
  });
}

/** Поиск пользователей по началу имени (регистрозависимо — ограничение Firestore). */
export async function searchUsers(prefix) {
  const base = collection(db, COLLECTIONS.USERS);
  const q = prefix
    ? query(base, orderBy('displayName'), startAt(prefix), endAt(`${prefix}`), limit(50))
    : query(base, orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Блокировка: правила разрешают только админу, не себе и не другому админу. */
export function setUserBan(uid, banned) {
  return updateDoc(doc(db, COLLECTIONS.USERS, uid), { banned });
}
