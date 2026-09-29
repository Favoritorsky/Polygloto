// Профиль: синхронизация имени автора в опубликованных курсах и очистка аватаров при удалении аккаунта.
import { getStorage } from 'firebase-admin/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { afterEach, describe, expect, it } from 'vitest';
import { adminAuth, adminDb, createClient, signUp, waitFor } from './helpers.js';

process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
const bucket = getStorage().bucket('demo-polygloto.appspot.com');

const clients = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});

describe('onUserProfileUpdated', () => {
  it('новое имя попадает в опубликованные курсы автора', async () => {
    const client = createClient();
    clients.push(client);
    const user = await signUp(client);
    const course = adminDb.collection('publicCourses').doc();
    await course.set({ authorId: user.uid, authorName: 'Старое имя', title: 'Курс', languageLower: 'x', language: 'x' });
    const other = adminDb.collection('publicCourses').doc();
    await other.set({ authorId: 'someone-else', authorName: 'Чужой', title: 'Курс', languageLower: 'x', language: 'x' });

    await updateDoc(doc(client.db, 'users', user.uid), { displayName: 'Новое имя' });
    await waitFor(async () => (await course.get()).data().authorName === 'Новое имя');
    expect((await other.get()).data().authorName).toBe('Чужой');
    await Promise.all([course.delete(), other.delete()]);
  });
});

describe('onUserDeleted', () => {
  it('удаляет аватары аккаунта, чужие не трогает', async () => {
    const client = createClient();
    clients.push(client);
    const user = await signUp(client);
    const mine = bucket.file(`avatars/${user.uid}/1.jpg`);
    const foreign = bucket.file(`avatars/other-${user.uid}/1.jpg`);
    await mine.save(Buffer.from('x'), { contentType: 'image/jpeg' });
    await foreign.save(Buffer.from('x'), { contentType: 'image/jpeg' });

    await adminAuth.deleteUser(user.uid);
    await waitFor(async () => !(await mine.exists())[0]);
    expect((await foreign.exists())[0]).toBe(true);
    expect((await adminDb.doc(`users/${user.uid}`).get()).exists).toBe(false);
    await foreign.delete();
  });
});

describe('onAvatarUploaded', () => {
  it('в папке аватаров остаются только три самых новых файла', async () => {
    const uid = `cap-${Date.now()}`;
    for (let i = 1; i <= 5; i += 1) {
      await bucket.file(`avatars/${uid}/${i}.jpg`).save(Buffer.from('x'), { contentType: 'image/jpeg' });
      await new Promise((r) => setTimeout(r, 30));
    }
    const names = async () => (await bucket.getFiles({ prefix: `avatars/${uid}/` }))[0].map((f) => f.name).sort();
    await waitFor(async () => (await names()).length === 3);
    expect(await names()).toEqual([3, 4, 5].map((i) => `avatars/${uid}/${i}.jpg`));
    await bucket.deleteFiles({ prefix: `avatars/${uid}/` });
  });
});
