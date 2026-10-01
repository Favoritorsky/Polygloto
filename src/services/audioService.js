/**
 * Аудиофайлы курса (v2): data URL в courses/{id}/audio/{audioId}, копия для
 * читателей — publicCourses/{id}/audio/{audioId}. Ограничения — shared/audio.js
 * и firestore.rules. Файл грузится, только когда его включают (кэш в памяти).
 */
import { collection, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { AUDIO_LIMITS, isValidAudioDataUrl, validateAudioFile, withAudioMime } from '../../shared/audio.js';
import { COLLECTIONS, RATE_LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { UserFacingError } from './errors.js';
import { db } from './firebase.js';
import { stampRateLimit, withRateLimit } from './rateLimit.js';

const cache = new Map();

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new UserFacingError('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}

/** Загружает файл в черновик курса. Возвращает id аудио. */
export async function uploadCourseAudio(uid, courseId, file) {
  const { mime, error } = validateAudioFile(file);
  if (error) throw new UserFacingError(error);
  const dataUrl = withAudioMime(await readAsDataUrl(file), mime);
  if (!isValidAudioDataUrl(dataUrl)) throw new UserFacingError('Файл слишком большой или повреждён.');
  const ref = doc(collection(db, COLLECTIONS.COURSES, courseId, SUBCOLLECTIONS.AUDIO));
  await withRateLimit(uid, 'uploadAudio', RATE_LIMITS.UPLOAD_AUDIO_SECONDS, async () => {
    const batch = writeBatch(db);
    batch.set(ref, {
      dataUrl,
      name: String(file.name ?? '').slice(0, AUDIO_LIMITS.NAME_MAX),
      createdAt: serverTimestamp(),
    });
    stampRateLimit(batch, uid, 'uploadAudio');
    await batch.commit();
  });
  cache.set(`${COLLECTIONS.COURSES}/${courseId}/${ref.id}`, dataUrl);
  return ref.id;
}

/**
 * Возвращает data URL файла. root — COLLECTIONS.COURSES (автор, модератор) или
 * COLLECTIONS.PUBLIC_COURSES (читатели).
 */
export async function loadCourseAudio(root, courseId, audioId) {
  const key = `${root}/${courseId}/${audioId}`;
  if (cache.has(key)) return cache.get(key);
  const snap = await getDoc(doc(db, root, courseId, SUBCOLLECTIONS.AUDIO, audioId));
  const dataUrl = snap.exists() ? snap.data().dataUrl : null;
  if (!isValidAudioDataUrl(dataUrl)) throw new UserFacingError('Аудиофайл не найден.');
  cache.set(key, dataUrl);
  return dataUrl;
}
