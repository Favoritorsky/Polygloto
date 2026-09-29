// Создание курса. Через функцию, а не напрямую из клиента, чтобы:
//  * работал rate limit (не чаще раза в RATE_LIMITS.CREATE_COURSE_SECONDS),
//  * authorId, статус и служебные поля выставлял сервер.
import { onCall } from 'firebase-functions/v2/https';
import { COLLECTIONS, COURSE_STATUS, LIMITS, RATE_LIMITS, SUBCOLLECTIONS } from '../../shared/schema.js';
import { db, FieldValue } from '../admin.js';
import { requireActiveUser, requireString } from '../lib/guards.js';
import { enforceRateLimit } from '../lib/rateLimit.js';

export const createCourse = onCall(async (request) => {
  const { auth } = await requireActiveUser(request);
  const data = request.data ?? {};
  const title = requireString(data.title, 'Название', { min: LIMITS.COURSE_TITLE_MIN, max: LIMITS.COURSE_TITLE_MAX });
  const language = requireString(data.language, 'Язык', {
    min: LIMITS.COURSE_LANGUAGE_MIN,
    max: LIMITS.COURSE_LANGUAGE_MAX,
  });
  const description = requireString(data.description ?? '', 'Описание', { max: LIMITS.COURSE_DESCRIPTION_MAX });

  const courseRef = db.collection(COLLECTIONS.COURSES).doc();
  const lessonRef = courseRef.collection(SUBCOLLECTIONS.LESSONS).doc();

  await db.runTransaction(async (tx) => {
    const commitRateLimit = await enforceRateLimit(tx, auth.uid, 'createCourse', RATE_LIMITS.CREATE_COURSE_SECONDS);
    tx.create(courseRef, {
      authorId: auth.uid,
      title,
      language,
      description,
      categories: [],
      lessonOrder: [lessonRef.id],
      referenceOrder: [],
      status: COURSE_STATUS.DRAFT,
      rejectionReason: null,
      hasPublishedVersion: false,
      submittedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Первый пустой урок, чтобы редактор сразу был готов к работе.
    tx.create(lessonRef, { title: 'Урок 1', blocks: [], updatedAt: FieldValue.serverTimestamp() });
    commitRateLimit();
  });

  return { courseId: courseRef.id };
});
