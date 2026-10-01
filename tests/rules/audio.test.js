import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anon, as, course, createEnv, seed, userProfile } from './helpers.js';

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
  await seed(env, 'users/bob', userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'courses/c1', course());
  await seed(env, 'courses/c1/audio/old', { dataUrl: 'data:audio/mpeg;base64,AAAA', name: 'a.mp3', createdAt: new Date() });
  await seed(env, 'publicCourses/c1', { authorId: 'alice', title: 'Курс' });
  await seed(env, 'publicCourses/c1/audio/old', { dataUrl: 'data:audio/mpeg;base64,AAAA' });
});

const AUDIO = 'data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=';

/** Загрузка как в audioService: файл + отметка rateLimits в одной записи. */
function upload(db, uid, path, data) {
  const batch = writeBatch(db);
  batch.set(doc(db, path), { dataUrl: AUDIO, name: 'rec.ogg', createdAt: serverTimestamp(), ...data });
  batch.set(doc(db, `rateLimits/${uid}`), { uploadAudio: serverTimestamp() }, { merge: true });
  return batch.commit();
}

describe('courses/{id}/audio', () => {
  it('автор загружает файл в черновик; чужой — нет', async () => {
    await assertSucceeds(upload(as(env, 'alice'), 'alice', 'courses/c1/audio/a1'));
    await assertFails(upload(as(env, 'bob'), 'bob', 'courses/c1/audio/b1'));
  });

  it('без отметки лимита и чаще раза в 5 с — нельзя', async () => {
    const db = as(env, 'alice');
    await assertFails(setDoc(doc(db, 'courses/c1/audio/a1'), { dataUrl: AUDIO, name: '', createdAt: serverTimestamp() }));
    await assertSucceeds(upload(db, 'alice', 'courses/c1/audio/a1'));
    await assertFails(upload(db, 'alice', 'courses/c1/audio/a2'));
  });

  it('только аудио в base64, лишние поля и большой файл отклоняются', async () => {
    for (const data of [
      { dataUrl: 'data:text/html;base64,PGI+' },
      { dataUrl: 'data:audio/mpeg;base64,<script>' },
      { dataUrl: 'https://upload.wikimedia.org/a.ogg' },
      { dataUrl: `data:audio/mpeg;base64,${'A'.repeat(480000)}` },
      { extra: 1 },
    ]) {
      await env.clearFirestore();
      await seed(env, 'users/alice', userProfile());
      await seed(env, 'courses/c1', course());
      await assertFails(upload(as(env, 'alice'), 'alice', 'courses/c1/audio/x', data));
    }
  });

  it('не в черновике загрузить нельзя; файл не меняется, удалить может автор', async () => {
    await seed(env, 'courses/c1', course({ status: 'pending_review' }));
    await assertFails(upload(as(env, 'alice'), 'alice', 'courses/c1/audio/a1'));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'courses/c1/audio/old'), { name: 'b' }));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'courses/c1/audio/old')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'courses/c1/audio/old')));
  });

  it('рабочие файлы читает автор и админ; опубликованные — все', async () => {
    await assertSucceeds(getDoc(doc(as(env, 'alice'), 'courses/c1/audio/old')));
    await assertSucceeds(getDoc(doc(as(env, 'admin'), 'courses/c1/audio/old')));
    await assertFails(getDoc(doc(as(env, 'bob'), 'courses/c1/audio/old')));
    await assertSucceeds(getDoc(doc(anon(env), 'publicCourses/c1/audio/old')));
  });

  it('в снимок пишет только админ; автор может удалить при удалении курса', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'publicCourses/c1/audio/x'), { dataUrl: AUDIO }));
    await assertSucceeds(setDoc(doc(as(env, 'admin'), 'publicCourses/c1/audio/x'), { dataUrl: AUDIO }));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'publicCourses/c1/audio/old')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'publicCourses/c1/audio/old')));
  });
});
