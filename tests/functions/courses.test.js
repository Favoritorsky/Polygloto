import { afterEach, describe, expect, it } from 'vitest';
import { CALLABLES, COURSE_STATUS } from '../../shared/schema.js';
import { adminDb, createClient, signUp, waitFor } from './helpers.js';

const clients = [];
function client() {
  const c = createClient();
  clients.push(c);
  return c;
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

const validCourse = { title: 'Эсперанто с нуля', language: 'Эсперанто', description: 'Курс' };

describe('createCourse', () => {
  it('создаёт черновик с первым уроком и серверными полями', async () => {
    const c = client();
    const user = await signUp(c); // без подтверждения почты — черновик разрешён
    const { courseId } = await c.call(CALLABLES.CREATE_COURSE, { ...validCourse, status: 'published', authorId: 'x' });
    const data = (await adminDb.doc(`courses/${courseId}`).get()).data();
    expect(data.authorId).toBe(user.uid);
    expect(data.status).toBe(COURSE_STATUS.DRAFT);
    expect(data.hasPublishedVersion).toBe(false);
    expect(data.lessonOrder).toHaveLength(1);
    const lesson = await adminDb.doc(`courses/${courseId}/lessons/${data.lessonOrder[0]}`).get();
    expect(lesson.exists).toBe(true);
  });

  it('rate limit: второй курс сразу — отказ', async () => {
    const c = client();
    await signUp(c);
    await c.call(CALLABLES.CREATE_COURSE, validCourse);
    await expect(c.call(CALLABLES.CREATE_COURSE, validCourse)).rejects.toMatchObject({
      code: 'functions/resource-exhausted',
    });
  });

  it('валидирует поля', async () => {
    const c = client();
    await signUp(c);
    await expect(c.call(CALLABLES.CREATE_COURSE, { ...validCourse, title: 'ab' })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
    await expect(c.call(CALLABLES.CREATE_COURSE, { ...validCourse, language: 5 })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
  });

  it('забаненный не может создать курс', async () => {
    const c = client();
    const user = await signUp(c);
    await adminDb.doc(`users/${user.uid}`).update({ banned: true });
    await expect(c.call(CALLABLES.CREATE_COURSE, validCourse)).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });

  it('аноним не может создать курс', async () => {
    const c = client();
    await expect(c.call(CALLABLES.CREATE_COURSE, validCourse)).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
  });
});

describe('onCourseDeleted', () => {
  it('удаляет подколлекции и опубликованную копию', async () => {
    await adminDb.doc('courses/del1').set({ authorId: 'u', status: 'published' });
    await adminDb.doc('courses/del1/lessons/a').set({ title: 'a', blocks: [] });
    await adminDb.doc('publicCourses/del1').set({ authorId: 'u' });
    await adminDb.doc('publicCourses/del1/lessons/a').set({ title: 'a', blocks: [] });
    await adminDb.doc('courses/del1').delete();
    await waitFor(async () => {
      const [l, p, pl] = await Promise.all([
        adminDb.doc('courses/del1/lessons/a').get(),
        adminDb.doc('publicCourses/del1').get(),
        adminDb.doc('publicCourses/del1/lessons/a').get(),
      ]);
      return !l.exists && !p.exists && !pl.exists;
    });
  });
});
