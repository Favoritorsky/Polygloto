import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { as, course, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, 'users/alice', userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'courses/pub', course({ status: 'published', hasPublishedVersion: true }));
  await seed(env, 'publicCourses/pub', { authorId: 'alice', title: 'Курс', languageLower: 'токипона', likesCount: 3, dislikesCount: 1 });
});

// Так отзывает moderationService.withdrawCourse: снимок удаляется вместе со сменой статуса.
function withdraw(db, id = 'pub', { deletePublic = true, changes = {} } = {}) {
  const batch = writeBatch(db);
  if (deletePublic) batch.delete(doc(db, `publicCourses/${id}`));
  batch.update(doc(db, `courses/${id}`), { status: 'draft', hasPublishedVersion: false, updatedAt: serverTimestamp(), ...changes });
  return batch.commit();
}

describe('отзыв опубликованного курса («Отозвать»)', () => {
  it('админ снимает курс с публикации — у автора он остаётся черновиком', async () => {
    await assertSucceeds(withdraw(as(env, 'admin')));
  });

  it('только вместе с удалением снимка', async () => {
    await assertFails(withdraw(as(env, 'admin'), 'pub', { deletePublic: false }));
  });

  it('нельзя заодно поменять другие поля', async () => {
    await assertFails(withdraw(as(env, 'admin'), 'pub', { changes: { title: 'Чужое название' } }));
    await assertFails(withdraw(as(env, 'admin'), 'pub', { changes: { rejectionReason: 'Причина' } }));
  });

  it('автор так не может (сбросить hasPublishedVersion — только админ)', async () => {
    await assertFails(withdraw(as(env, 'alice')));
  });

  it('без снимка в publicCourses сбросить hasPublishedVersion нельзя', async () => {
    await seed(env, 'courses/ghost', course({ status: 'published', hasPublishedVersion: true }));
    await assertFails(withdraw(as(env, 'admin'), 'ghost', { deletePublic: false }));
  });
});
