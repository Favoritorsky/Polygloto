import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anon, as, createEnv, seed, userProfile } from './helpers.js';

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
  await seed(env, 'users/bob', userProfile({ displayName: 'Боб' }));
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'users/banned', userProfile({ banned: true }));
});

describe('users: чтение', () => {
  it('профиль читается всеми, включая анонимов', async () => {
    await assertSucceeds(getDoc(doc(anon(env), 'users/alice')));
    await assertSucceeds(getDoc(doc(as(env, 'bob'), 'users/alice')));
  });

  it('перечислять пользователей может только админ', async () => {
    await assertFails(getDocs(collection(anon(env), 'users')));
    await assertFails(getDocs(collection(as(env, 'alice'), 'users')));
    await assertSucceeds(getDocs(collection(as(env, 'admin'), 'users')));
  });
});

describe('users: создание и удаление', () => {
  it('клиент не может создать профиль (его создаёт триггер)', async () => {
    await assertFails(setDoc(doc(as(env, 'carol'), 'users/carol'), userProfile()));
  });

  it('клиент не может создать профиль с ролью admin', async () => {
    await assertFails(setDoc(doc(as(env, 'carol'), 'users/carol'), userProfile({ role: 'admin' })));
  });

  it('клиент не может удалить свой или чужой профиль', async () => {
    await assertFails(deleteDoc(doc(as(env, 'alice'), 'users/alice')));
    await assertFails(deleteDoc(doc(as(env, 'alice'), 'users/bob')));
  });
});

describe('users: обновление', () => {
  it('владелец меняет имя, bio и аватар', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, 'alice'), 'users/alice'), {
        displayName: 'Алиса',
        bio: 'Пишу курс по токипоне',
        photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Falice%2Fa.png?alt=media',
      }),
    );
  });

  it('роль менять нельзя: ни повысить до admin, ни до user', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(env, 'alice', { verified: true }), 'users/alice'), { role: 'user' }));
  });

  it('админ через клиент тоже не может менять роли (только консоль/функции)', async () => {
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/admin'), { role: 'reader' }));
  });

  it('нельзя снять с себя бан или сбросить счётчики', async () => {
    await assertFails(updateDoc(doc(as(env, 'banned'), 'users/banned'), { banned: false }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { commentsCount: 1000 }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { banned: true }));
  });

  it('нельзя подменить createdAt или добавить новое поле (например emailVerified)', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { emailVerified: true }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { createdAt: new Date(0) }));
  });

  it('нельзя менять чужой профиль', async () => {
    await assertFails(updateDoc(doc(as(env, 'bob'), 'users/alice'), { displayName: 'Взлом' }));
    await assertFails(updateDoc(doc(anon(env), 'users/alice'), { displayName: 'Взлом' }));
  });

  it('забаненный не может менять профиль', async () => {
    await assertFails(updateDoc(doc(as(env, 'banned'), 'users/banned'), { bio: 'спам' }));
  });

  it('полная перезапись setDoc с изменённой ролью запрещена', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice'), userProfile({ role: 'admin' })));
  });

  it('проверяются длины полей', async () => {
    const ref = doc(as(env, 'alice'), 'users/alice');
    await assertFails(updateDoc(ref, { displayName: 'A' }));
    await assertFails(updateDoc(ref, { displayName: 'x'.repeat(41) }));
    await assertSucceeds(updateDoc(ref, { displayName: 'x'.repeat(40) }));
    await assertFails(updateDoc(ref, { displayName: '  пробелы  ' }));
    await assertFails(updateDoc(ref, { bio: 'x'.repeat(501) }));
    await assertSucceeds(updateDoc(ref, { bio: 'x'.repeat(500) }));
    await assertFails(updateDoc(ref, { displayName: 42 }));
  });

  it('аватар — только URL Firebase Storage', async () => {
    const ref = doc(as(env, 'alice'), 'users/alice');
    await assertFails(updateDoc(ref, { photoURL: 'javascript:alert(1)' }));
    await assertFails(updateDoc(ref, { photoURL: 'https://evil.example.com/pixel.gif' }));
    await assertSucceeds(updateDoc(ref, { photoURL: null }));
  });

  it('аватар — только из своей папки avatars/{uid}/', async () => {
    const ref = doc(as(env, 'alice'), 'users/alice');
    const own = 'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/avatars%2Falice%2F17000.jpg?alt=media&token=abc';
    await assertSucceeds(updateDoc(ref, { photoURL: own }));
    await assertSucceeds(updateDoc(ref, { photoURL: 'http://127.0.0.1:9199/v0/b/demo/o/avatars%2Falice%2Fa.webp?alt=media' }));
    // Чужой файл, другой путь, попытка выйти из папки, похожий домен.
    await assertFails(updateDoc(ref, { photoURL: own.replace('alice', 'bob') }));
    await assertFails(updateDoc(ref, { photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/courses%2Fa.png' }));
    await assertFails(updateDoc(ref, { photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Falice%2F..%2Fbob%2Fa.png' }));
    await assertFails(updateDoc(ref, { photoURL: 'https://firebasestorage.googleapis.com.evil.io/v0/b/x/o/avatars%2Falice%2Fa.png' }));
    await assertFails(updateDoc(ref, { photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/avatars%2Falicex%2Fa.png' }));
  });
});

describe('rateLimits', () => {
  it('клиенту закрыты полностью', async () => {
    await seed(env, 'rateLimits/alice', { createCourse: new Date() });
    await assertFails(getDoc(doc(as(env, 'alice'), 'rateLimits/alice')));
    await assertFails(setDoc(doc(as(env, 'alice'), 'rateLimits/alice'), { createCourse: null }));
  });
});
