/**
 * Экспорт курса в JSON и импорт из JSON в новый черновик (v2).
 * Формат и очистка — shared/courseExport.js.
 */
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { LANGUAGE_CATEGORY, languageFieldsForName } from '../../shared/languages.js';
import { buildCourseExport, exportFileName, IMPORT_LIMITS, parseCourseImport } from '../../shared/courseExport.js';
import { COLLECTIONS, RATE_LIMITS, SUBCOLLECTIONS, normalizeText, LIMITS } from '../../shared/schema.js';
import { createCourse } from './courseService.js';
import { UserFacingError } from './errors.js';
import { db } from './firebase.js';
import { listCuratedLanguages } from './languageService.js';
import { stampRateLimit } from './rateLimit.js';

const OPS_PER_BATCH = 100;

function ordered(docs, order) {
  const byId = new Map(docs.map((d) => [d.id, d.data()]));
  const ids = [...(order ?? []).filter((id) => byId.has(id)), ...docs.map((d) => d.id).filter((id) => !(order ?? []).includes(id))];
  return ids.map((id) => byId.get(id));
}

/** Собирает файл экспорта рабочей версии курса. Возвращает { fileName, json }. */
export async function exportCourse(courseId) {
  const ref = doc(db, COLLECTIONS.COURSES, courseId);
  const read = (name) => getDocs(collection(ref, name));
  const [courseSnap, lessons, reference, dictionary, audio] = await Promise.all([
    getDoc(ref),
    read(SUBCOLLECTIONS.LESSONS),
    read(SUBCOLLECTIONS.REFERENCE),
    read(SUBCOLLECTIONS.DICTIONARY),
    read(SUBCOLLECTIONS.AUDIO),
  ]);
  if (!courseSnap.exists()) throw new UserFacingError('Курс не найден.');
  const course = courseSnap.data();
  const file = buildCourseExport({
    course,
    lessons: ordered(lessons.docs, course.lessonOrder),
    reference: ordered(reference.docs, course.referenceOrder),
    dictionary: dictionary.docs.map((d) => ({ id: d.id, ...d.data() })),
    audio: audio.docs.map((d) => ({ id: d.id, ...d.data() })),
  });
  return { fileName: exportFileName(course.title), json: JSON.stringify(file, null, 2) };
}

/** Читает и проверяет выбранный файл. Возвращает очищенные данные (с warnings). */
export async function readImportFile(file) {
  if (file.size > IMPORT_LIMITS.FILE_MAX_BYTES) throw new UserFacingError('Файл больше 15 МБ.');
  const { data, error } = parseCourseImport(await file.text());
  if (error) throw new UserFacingError(error);
  return data;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создаёт новый черновик из данных импорта. Порядок — тот, что разрешают
 * правила: курс (с лимитом частоты) → содержимое пакетами → аудио по одному
 * файлу не чаще раза в 5 с. onProgress(text) — для индикатора.
 */
export async function importCourse(uid, data, onProgress = () => {}) {
  onProgress('Создаю курс…');
  const curated = await listCuratedLanguages();
  const languageFields =
    data.course.languageCategory === LANGUAGE_CATEGORY.CUSTOM
      ? { language: data.course.language, languageCategory: LANGUAGE_CATEGORY.CUSTOM, languageId: null }
      : languageFieldsForName(data.course.language, curated);
  const courseId = await createCourse(uid, { ...data.course, ...languageFields });
  const courseRef = doc(db, COLLECTIONS.COURSES, courseId);
  const firstLessonId = (await getDoc(courseRef)).data().lessonOrder[0];

  const lessonIds = data.lessons.map((_, i) => (i === 0 ? firstLessonId : doc(collection(courseRef, SUBCOLLECTIONS.LESSONS)).id));
  const referenceIds = data.reference.map(() => doc(collection(courseRef, SUBCOLLECTIONS.REFERENCE)).id);
  const ops = [];
  data.lessons.forEach((s, i) =>
    ops.push((b) =>
      b.set(doc(courseRef, SUBCOLLECTIONS.LESSONS, lessonIds[i]), { title: s.title, blocks: s.blocks, updatedAt: serverTimestamp() }),
    ),
  );
  data.reference.forEach((s, i) =>
    ops.push((b) =>
      b.set(doc(courseRef, SUBCOLLECTIONS.REFERENCE, referenceIds[i]), { title: s.title, blocks: s.blocks, updatedAt: serverTimestamp() }),
    ),
  );
  data.dictionary.forEach(({ id, ...word }) =>
    ops.push((b) =>
      b.set(doc(courseRef, SUBCOLLECTIONS.DICTIONARY, id), {
        ...word,
        wordLower: normalizeText(word.word).slice(0, LIMITS.WORD_MAX),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  // Порядок разделов и категории — первой записью: правила содержимого проверяют курс после неё.
  const meta = writeBatch(db);
  meta.update(courseRef, {
    categories: data.course.categories,
    lessonOrder: lessonIds,
    referenceOrder: referenceIds,
    updatedAt: serverTimestamp(),
  });
  await meta.commit();
  for (let i = 0; i < ops.length; i += OPS_PER_BATCH) {
    onProgress(`Записываю уроки и словарь: ${Math.min(i + OPS_PER_BATCH, ops.length)} из ${ops.length}…`);
    const batch = writeBatch(db);
    ops.slice(i, i + OPS_PER_BATCH).forEach((op) => op(batch));
    await batch.commit();
  }

  for (const [i, audio] of data.audio.entries()) {
    onProgress(`Загружаю аудио: ${i + 1} из ${data.audio.length}…`);
    if (i > 0) await wait(RATE_LIMITS.UPLOAD_AUDIO_SECONDS * 1000 + 300);
    const batch = writeBatch(db);
    batch.set(doc(courseRef, SUBCOLLECTIONS.AUDIO, audio.id), { dataUrl: audio.dataUrl, name: audio.name, createdAt: serverTimestamp() });
    stampRateLimit(batch, uid, 'uploadAudio');
    await batch.commit();
  }
  return courseId;
}
