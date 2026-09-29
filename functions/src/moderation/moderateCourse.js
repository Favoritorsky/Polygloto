// Модерация: только админ одобряет (публикует) или отклоняет курс на проверке.
// Одобрение копирует рабочую версию в publicCourses/{id}, полностью заменяя
// прежний снимок; комментарии и оценки (courses/{id}/…) не затрагиваются.
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  COLLECTIONS,
  CONTENT_SUBCOLLECTIONS,
  COURSE_STATUS,
  LIMITS,
  SUBCOLLECTIONS,
} from '../../shared/schema.js';
import { db, FieldValue } from '../admin.js';
import { requireAdmin, requireString } from '../lib/guards.js';
import { buildPublicSnapshot } from './buildPublicSnapshot.js';

async function readCollection(ref) {
  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

async function reject(courseRef, reason) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(courseRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Курс не найден.');
    if (snap.get('status') !== COURSE_STATUS.PENDING_REVIEW) {
      throw new HttpsError('failed-precondition', 'Курс уже не на проверке.');
    }
    tx.update(courseRef, {
      status: COURSE_STATUS.REJECTED,
      rejectionReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function approve(courseRef, moderatorId) {
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) throw new HttpsError('not-found', 'Курс не найден.');
  const course = courseSnap.data();
  if (course.status !== COURSE_STATUS.PENDING_REVIEW) {
    throw new HttpsError('failed-precondition', 'Курс уже не на проверке.');
  }
  const submittedAt = course.submittedAt?.toMillis?.() ?? null;

  // В статусе pending_review контент заморожен правилами, поэтому прочитанное —
  // ровно та версия, которую отправил автор.
  const [lessons, reference, dictionary, authorSnap] = await Promise.all([
    readCollection(courseRef.collection(SUBCOLLECTIONS.LESSONS)),
    readCollection(courseRef.collection(SUBCOLLECTIONS.REFERENCE)),
    readCollection(courseRef.collection(SUBCOLLECTIONS.DICTIONARY)),
    db.collection(COLLECTIONS.USERS).doc(course.authorId).get(),
  ]);
  const snapshot = buildPublicSnapshot({
    course,
    author: authorSnap.data(),
    lessons,
    reference,
    dictionary,
  });

  // Фиксируем решение, только если за время чтения курс не отозвали и не
  // переотправили (иначе опубликовали бы не ту версию).
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(courseRef);
    if (!fresh.exists) throw new HttpsError('not-found', 'Курс удалён.');
    const freshSubmitted = fresh.get('submittedAt')?.toMillis?.() ?? null;
    if (fresh.get('status') !== COURSE_STATUS.PENDING_REVIEW || freshSubmitted !== submittedAt) {
      throw new HttpsError('aborted', 'Автор изменил курс во время проверки. Обновите страницу.');
    }
    tx.update(courseRef, {
      status: COURSE_STATUS.PUBLISHED,
      rejectionReason: null,
      hasPublishedVersion: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  try {
    await writePublicSnapshot(courseRef, snapshot, moderatorId);
  } catch (error) {
    // Снимок не записан — возвращаем курс в очередь, чтобы можно было повторить.
    await courseRef.update({
      status: COURSE_STATUS.PENDING_REVIEW,
      hasPublishedVersion: course.hasPublishedVersion === true,
    });
    throw new HttpsError('internal', 'Не удалось опубликовать курс, попробуйте ещё раз.', String(error));
  }
}

async function writePublicSnapshot(courseRef, snapshot, moderatorId) {
  // Сначала — подколлекции, в самом конце — документ курса,
  // чтобы в каталоге курс появлялся уже с контентом.
  const publicRef = db.collection(COLLECTIONS.PUBLIC_COURSES).doc(courseRef.id);
  const writer = db.bulkWriter();
  const sections = {
    [SUBCOLLECTIONS.LESSONS]: snapshot.lessons,
    [SUBCOLLECTIONS.REFERENCE]: snapshot.reference,
    [SUBCOLLECTIONS.DICTIONARY]: snapshot.dictionary,
  };
  for (const name of CONTENT_SUBCOLLECTIONS) {
    const target = publicRef.collection(name);
    const keep = new Set(sections[name].map((d) => d.id));
    const existing = await target.listDocuments();
    for (const ref of existing) if (!keep.has(ref.id)) writer.delete(ref);
    for (const { id, data } of sections[name]) writer.set(target.doc(id), data);
  }
  await writer.close();

  const existing = await publicRef.get();
  await publicRef.set(
    {
      ...snapshot.meta,
      likesCount: existing.exists ? existing.get('likesCount') ?? 0 : 0,
      dislikesCount: existing.exists ? existing.get('dislikesCount') ?? 0 : 0,
      score: existing.exists ? existing.get('score') ?? 0 : 0,
      publishedAt: existing.exists ? existing.get('publishedAt') : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      approvedBy: moderatorId,
    },
  );
}

export const moderateCourse = onCall(async (request) => {
  const { auth } = await requireAdmin(request);
  const { courseId, decision, reason } = request.data ?? {};
  if (typeof courseId !== 'string' || !courseId) throw new HttpsError('invalid-argument', 'Не указан курс.');
  const courseRef = db.collection(COLLECTIONS.COURSES).doc(courseId);

  if (decision === 'reject') {
    const text = requireString(reason, 'Причина отклонения', {
      min: LIMITS.REJECTION_REASON_MIN,
      max: LIMITS.REJECTION_REASON_MAX,
    });
    await reject(courseRef, text);
    return { status: COURSE_STATUS.REJECTED };
  }
  if (decision === 'approve') {
    await approve(courseRef, auth.uid);
    return { status: COURSE_STATUS.PUBLISHED };
  }
  throw new HttpsError('invalid-argument', 'Неизвестное решение.');
});
