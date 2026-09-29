import { afterEach, describe, expect, it } from 'vitest';
import { CALLABLES, COURSE_STATUS } from '../../shared/schema.js';
import { adminDb, createClient, signUp } from './helpers.js';

const clients = [];
function client() {
  const c = createClient();
  clients.push(c);
  return c;
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

async function seedPendingCourse(authorId, id = `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`) {
  const ref = adminDb.doc(`courses/${id}`);
  await ref.set({
    authorId,
    title: 'Токипона',
    language: 'Токипона',
    description: 'Описание',
    categories: [{ id: 'cat_a', name: 'Гласные', color: '#e63946' }, { id: 'bad id!', name: 'x', color: 'red' }],
    lessonOrder: ['l2', 'l1'],
    referenceOrder: [],
    status: COURSE_STATUS.PENDING_REVIEW,
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await ref.collection('lessons').doc('l1').set({
    title: 'Первый',
    blocks: [
      { type: 'paragraph', children: [{ text: 'toki', color: 'url(evil)', category: 'cat_a', onclick: 'x' }] },
      { type: 'script', children: [] },
    ],
  });
  await ref.collection('lessons').doc('l2').set({ title: 'Второй', blocks: [] });
  await ref.collection('dictionary').doc('w1').set({ word: 'toki', translation: 'язык', partOfSpeech: 'noun', examples: [], notes: '', hack: true });
  return ref;
}

describe('moderateCourse', () => {
  it('не-админ не может модерировать', async () => {
    const c = client();
    const user = await signUp(c, { verified: true });
    const ref = await seedPendingCourse(user.uid);
    await expect(c.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'approve' })).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });

  it('одобрение публикует очищенный снимок', async () => {
    const author = client();
    const authorUser = await signUp(author);
    const ref = await seedPendingCourse(authorUser.uid);
    const admin = client();
    await signUp(admin, { verified: true, role: 'admin' });

    await expect(admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'approve' })).resolves.toEqual({
      status: COURSE_STATUS.PUBLISHED,
    });
    const course = (await ref.get()).data();
    expect(course.status).toBe(COURSE_STATUS.PUBLISHED);
    expect(course.hasPublishedVersion).toBe(true);

    const pub = (await adminDb.doc(`publicCourses/${ref.id}`).get()).data();
    expect(pub).toMatchObject({ authorId: authorUser.uid, title: 'Токипона', lessonsCount: 2, wordsCount: 1, likesCount: 0 });
    expect(pub.authorName).toMatch(/^Автор-/);
    expect(pub.lessonOrder).toEqual(['l2', 'l1']);
    expect(pub.categories).toEqual([{ id: 'cat_a', name: 'Гласные', color: '#e63946' }]);
    expect(pub.searchKeywords).toContain('ток');

    const lesson = (await adminDb.doc(`publicCourses/${ref.id}/lessons/l1`).get()).data();
    expect(lesson.blocks).toEqual([{ type: 'paragraph', children: [{ text: 'toki', category: 'cat_a' }] }]);
    const word = (await adminDb.doc(`publicCourses/${ref.id}/dictionary/w1`).get()).data();
    expect(word.hack).toBeUndefined();
  });

  it('повторная публикация заменяет снимок, но сохраняет оценки', async () => {
    const author = client();
    const authorUser = await signUp(author);
    const ref = await seedPendingCourse(authorUser.uid);
    const admin = client();
    await signUp(admin, { verified: true, role: 'admin' });
    await admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'approve' });
    await adminDb.doc(`publicCourses/${ref.id}`).update({ likesCount: 7, score: 7 });

    // Автор правит: удаляет урок l1, меняет название, снова отправляет.
    await ref.collection('lessons').doc('l1').delete();
    await ref.update({ title: 'Токипона 2.0', lessonOrder: ['l2'], status: COURSE_STATUS.PENDING_REVIEW, submittedAt: new Date() });
    await admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'approve' });

    const pub = (await adminDb.doc(`publicCourses/${ref.id}`).get()).data();
    expect(pub.title).toBe('Токипона 2.0');
    expect(pub.likesCount).toBe(7);
    expect((await adminDb.doc(`publicCourses/${ref.id}/lessons/l1`).get()).exists).toBe(false);
  });

  it('отклонение требует причину и сохраняет её', async () => {
    const author = client();
    const authorUser = await signUp(author);
    const ref = await seedPendingCourse(authorUser.uid);
    const admin = client();
    await signUp(admin, { verified: true, role: 'admin' });
    await expect(admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'reject', reason: '' })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
    await admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'reject', reason: 'Мало материала' });
    const course = (await ref.get()).data();
    expect(course.status).toBe(COURSE_STATUS.REJECTED);
    expect(course.rejectionReason).toBe('Мало материала');
    expect((await adminDb.doc(`publicCourses/${ref.id}`).get()).exists).toBe(false);
  });

  it('курс не на проверке нельзя одобрить', async () => {
    const author = client();
    const authorUser = await signUp(author);
    const ref = await seedPendingCourse(authorUser.uid);
    await ref.update({ status: COURSE_STATUS.DRAFT });
    const admin = client();
    await signUp(admin, { verified: true, role: 'admin' });
    await expect(admin.call(CALLABLES.MODERATE_COURSE, { courseId: ref.id, decision: 'approve' })).rejects.toMatchObject({
      code: 'functions/failed-precondition',
    });
  });
});

describe('setUserBan', () => {
  it('админ банит и разбанивает пользователя', async () => {
    const victim = client();
    const victimUser = await signUp(victim);
    const admin = client();
    await signUp(admin, { verified: true, role: 'admin' });
    await admin.call(CALLABLES.SET_USER_BAN, { uid: victimUser.uid, banned: true });
    expect((await adminDb.doc(`users/${victimUser.uid}`).get()).get('banned')).toBe(true);
    await admin.call(CALLABLES.SET_USER_BAN, { uid: victimUser.uid, banned: false });
    expect((await adminDb.doc(`users/${victimUser.uid}`).get()).get('banned')).toBe(false);
  });

  it('нельзя забанить себя, другого админа; не-админ не может банить', async () => {
    const admin = client();
    const adminUser = await signUp(admin, { verified: true, role: 'admin' });
    const admin2 = client();
    const admin2User = await signUp(admin2, { verified: true, role: 'admin' });
    const user = client();
    await signUp(user, { verified: true });
    await expect(admin.call(CALLABLES.SET_USER_BAN, { uid: adminUser.uid, banned: true })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(admin.call(CALLABLES.SET_USER_BAN, { uid: admin2User.uid, banned: true })).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    await expect(user.call(CALLABLES.SET_USER_BAN, { uid: adminUser.uid, banned: true })).rejects.toMatchObject({ code: 'functions/permission-denied' });
  });
});
