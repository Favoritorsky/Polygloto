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
import { BATCH_SIZE, deleteAllDocs } from './batchUtils.js';
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

/** Данные документа в сравнимом виде: ключи по алфавиту, метки времени — числом. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value.toMillis === 'function') return { $time: value.toMillis() };
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  }
  return value;
}

const sameData = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/**
 * Пишет подколлекции снимка: удаляет устаревшие документы и записывает новые.
 * Неизменившиеся документы не переписываются — иначе повторная публикация
 * (например, после смены названия) заново пишет весь словарь в тысячи слов.
 */
async function writeSnapshotSections(publicRef, snapshot, onProgress) {
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
    const current = new Map(existing.docs.map((d) => [d.id, d.data()]));
    existing.docs.filter((d) => !keep.has(d.id)).forEach((d) => ops.push((b) => b.delete(d.ref)));
    sections[name]
      .filter(({ id, data }) => !current.has(id) || !sameData(current.get(id), data))
      .forEach(({ id, data }) => ops.push((b) => b.set(doc(target, id), data)));
  }
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    onProgress(`Публикую содержимое: ${Math.min(i + BATCH_SIZE, ops.length)} из ${ops.length}…`);
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
async function copySnapshotAudio(courseRef, publicRef, snapshot, onProgress) {
  const ids = collectAudioIds([snapshot.lessons, snapshot.reference, snapshot.dictionary]);
  const target = collection(publicRef, SUBCOLLECTIONS.AUDIO);
  const existing = await getDocs(target);
  const present = new Set(existing.docs.map((d) => d.id));
  for (const d of existing.docs) if (!ids.has(d.id)) await deleteDoc(d.ref);
  const missing = [...ids].filter((id) => !present.has(id)); // файлы не меняются (update запрещён), копировать заново не нужно
  for (const [i, id] of missing.entries()) {
    onProgress(`Копирую аудио: ${i + 1} из ${missing.length}…`);
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
export async function approveCourse(courseId, moderatorId, onProgress = () => {}) {
  const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  const metaRef = doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC);

  const courseSnap = await getDoc(courseRef);
  if (!courseSnap.exists()) throw new UserFacingError('Курс удалён.');
  const course = courseSnap.data();
  if (course.status !== COURSE_STATUS.PENDING_REVIEW) throw new UserFacingError('Курс уже не на проверке.');
  const submittedAt = course.submittedAt?.toMillis?.() ?? null;

  onProgress('Читаю курс…');
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
  // Язык могли убрать из курируемого списка, пока курс ждал проверки: тогда он «Другой язык».
  if (snapshot.meta.languageId && !(await getDoc(doc(db, COLLECTIONS.CURATED_LANGUAGES, snapshot.meta.languageId))).exists()) {
    snapshot.meta.languageCategory = 'custom';
    snapshot.meta.languageId = null;
  }
  const previous = previousSnap.exists() ? previousSnap.data() : null;

  onProgress('Сравниваю с опубликованной версией…');
  await writeSnapshotSections(publicRef, snapshot, onProgress);
  await copySnapshotAudio(courseRef, publicRef, snapshot, onProgress);
  onProgress('Завершаю публикацию…');
  const counts = await languageCounts(courseId, previous, snapshot.meta);

  await runTransaction(db, async (tx) => {
    const [fresh, current, metaSnap] = await Promise.all([tx.get(courseRef), tx.get(publicRef), tx.get(metaRef)]);
    if (!fresh.exists()) throw new UserFacingError('Курс удалён.');
    const freshSubmitted = fresh.data().submittedAt?.toMillis?.() ?? null;
    if (fresh.data().status !== COURSE_STATUS.PENDING_REVIEW || freshSubmitted !== submittedAt) {
      throw new UserFacingError('Автор изменил курс во время проверки. Обновите страницу.');
    }
    // Счётчики оценок сохраняются между версиями; для первой публикации — нули,
    // а после отзыва (withdrawCourse) — сохранённые при отзыве: голоса читателей остались в ratings.
    const saved = current.exists() ? null : await tx.get(withdrawnRef(courseId));
    const counters = current.exists()
      ? {}
      : saved?.exists()
        ? {
            likesCount: saved.data().likesCount ?? 0,
            dislikesCount: saved.data().dislikesCount ?? 0,
            score: (saved.data().likesCount ?? 0) - (saved.data().dislikesCount ?? 0),
            publishedAt: saved.data().publishedAt ?? serverTimestamp(),
          }
        : {
            likesCount: 0,
            dislikesCount: 0,
            score: 0,
            publishedAt: serverTimestamp(),
          };
    if (saved?.exists()) tx.delete(withdrawnRef(courseId));
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

/** catalogMeta/withdrawn-{id}: счётчики оценок отозванного курса до повторной публикации. */
const withdrawnRef = (courseId) => doc(db, COLLECTIONS.CATALOG_META, `withdrawn-${courseId}`);

/**
 * «Отозвать»: курс пропадает из общего доступа, но не удаляется — у автора он
 * остаётся черновиком (status draft, hasPublishedVersion false) и может быть
 * снова отправлен на проверку. Подколлекции снимка удаляются заранее, сам
 * снимок — одной транзакцией со сменой статуса (это требует правило isWithdrawal)
 * и пересчётом языков каталога. Комментарии и голоса остаются под courses/{id}
 * (без снимка их никто не видит), счётчики голосов сохраняются в catalogMeta.
 */
export async function withdrawCourse(courseId) {
  const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
  const publicRef = doc(db, COLLECTIONS.PUBLIC_COURSES, courseId);
  const metaRef = doc(db, COLLECTIONS.CATALOG_META, CATALOG_LANGUAGES_DOC);

  const publicSnap = await getDoc(publicRef);
  if (!publicSnap.exists()) throw new UserFacingError('Курс уже снят с публикации.');
  const published = publicSnap.data();
  for (const name of [...CONTENT_SUBCOLLECTIONS, SUBCOLLECTIONS.AUDIO, SUBCOLLECTIONS.TASK_STATS]) {
    await deleteAllDocs(collection(publicRef, name));
  }
  const key = published.languageLower;
  const left = key
    ? (await getCountFromServer(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('languageLower', '==', key)))).data().count - 1
    : 0;

  await runTransaction(db, async (tx) => {
    const [course, metaSnap] = await Promise.all([tx.get(courseRef), tx.get(metaRef)]);
    tx.set(withdrawnRef(courseId), {
      likesCount: published.likesCount ?? 0,
      dislikesCount: published.dislikesCount ?? 0,
      publishedAt: published.publishedAt ?? null,
    });
    tx.delete(publicRef);
    if (course.exists()) {
      tx.update(courseRef, { status: COURSE_STATUS.DRAFT, hasPublishedVersion: false, updatedAt: serverTimestamp() });
    }
    if (key && metaSnap.exists()) {
      const items = (metaSnap.data().items ?? []).flatMap((i) => (i.key !== key ? [i] : left > 0 ? [{ ...i, count: left }] : []));
      tx.set(metaRef, { items });
    }
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
