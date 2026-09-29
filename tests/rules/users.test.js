import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

// Профиль, который создаёт клиент сразу после регистрации (userService.createOwnProfile).
const newProfile = (overrides = {}) => ({
  displayName: 'Кэрол',
  bio: '',
  photoURL: null,
  role: 'reader',
  banned: false,
  createdAt: serverTimestamp(),
  ...overrides,
});

describe('users: создание и удаление', () => {
  it('пользователь создаёт свой профиль с ролью reader', async () => {
    await assertSucceeds(setDoc(doc(as(env, 'carol'), 'users/carol'), newProfile()));
  });

  it('роль user при создании — только с подтверждённой почтой', async () => {
    await assertFails(setDoc(doc(as(env, 'carol'), 'users/carol'), newProfile({ role: 'user' })));
    await assertSucceeds(setDoc(doc(as(env, 'carol', { verified: true }), 'users/carol'), newProfile({ role: 'user' })));
  });

  it('нельзя создать профиль с ролью admin, баном, лишними полями или чужим uid', async () => {
    const ref = doc(as(env, 'carol', { verified: true }), 'users/carol');
    await assertFails(setDoc(ref, newProfile({ role: 'admin' })));
    await assertFails(setDoc(ref, newProfile({ banned: true })));
    await assertFails(setDoc(ref, newProfile({ commentsCount: 1000 })));
    await assertFails(setDoc(ref, newProfile({ createdAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(ref, newProfile({ displayName: 'К' })));
    await assertFails(setDoc(doc(as(env, 'carol'), 'users/dave'), newProfile()));
    await assertFails(setDoc(doc(anon(env), 'users/carol'), newProfile()));
  });

  it('существующий профиль повторным созданием не перезаписать', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'users/alice'), newProfile()));
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
        photoURL: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      }),
    );
  });

  it('reader → user — только с подтверждённой почтой; другие смены роли запрещены', async () => {
    await assertFails(updateDoc(doc(as(env, 'alice'), 'users/alice'), { role: 'user' }));
    await assertFails(updateDoc(doc(as(env, 'alice', { verified: true }), 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(env, 'alice', { verified: true }), 'users/alice'), { role: 'user', bio: 'и ещё' }));
    await assertSucceeds(updateDoc(doc(as(env, 'alice', { verified: true }), 'users/alice'), { role: 'user' }));
    await assertFails(updateDoc(doc(as(env, 'alice', { verified: true }), 'users/alice'), { role: 'reader' }));
    await assertFails(updateDoc(doc(as(env, 'bob', { verified: true }), 'users/alice'), { role: 'user' }));
  });

  it('админ через клиент тоже не может менять роли (только консоль)', async () => {
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/alice'), { role: 'admin' }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/admin'), { role: 'reader' }));
  });

  it('банит только админ: не себя, не другого админа и ничего, кроме поля banned', async () => {
    await seed(env, 'users/admin2', userProfile({ role: 'admin' }));
    await assertSucceeds(updateDoc(doc(as(env, 'admin'), 'users/alice'), { banned: true }));
    await assertSucceeds(updateDoc(doc(as(env, 'admin'), 'users/alice'), { banned: false }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/admin'), { banned: true }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/admin2'), { banned: true }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/alice'), { banned: true, displayName: 'Спамер' }));
    await assertFails(updateDoc(doc(as(env, 'admin'), 'users/alice'), { banned: 'yes' }));
    await assertFails(updateDoc(doc(as(env, 'bob'), 'users/alice'), { banned: true }));
  });

  it('нельзя снять с себя бан или добавить себе счётчики', async () => {
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

  it('аватар — только небольшой JPEG в виде data URL', async () => {
    const ref = doc(as(env, 'alice'), 'users/alice');
    const jpeg = `data:image/jpeg;base64,${'A'.repeat(1000)}==`;
    await assertSucceeds(updateDoc(ref, { photoURL: jpeg }));
    await assertSucceeds(updateDoc(ref, { photoURL: null }));
    await assertFails(updateDoc(ref, { photoURL: 'https://evil.example.com/pixel.gif' }));
    await assertFails(updateDoc(ref, { photoURL: 'javascript:alert(1)' }));
    await assertFails(updateDoc(ref, { photoURL: `data:image/svg+xml;base64,${'A'.repeat(100)}` }));
    await assertFails(updateDoc(ref, { photoURL: `data:text/html;base64,${'A'.repeat(100)}` }));
    await assertFails(updateDoc(ref, { photoURL: `data:image/jpeg;base64,AAAA"onerror="alert(1)` }));
    await assertFails(updateDoc(ref, { photoURL: `data:image/jpeg;base64,${'A'.repeat(40000)}` }));
  });
});

describe('rateLimits', () => {
  const ago = (seconds) => Timestamp.fromMillis(Date.now() - seconds * 1000);

  it('свою отметку читает только владелец', async () => {
    await seed(env, 'rateLimits/alice', { createCourse: ago(100) });
    await assertSucceeds(getDoc(doc(as(env, 'alice'), 'rateLimits/alice')));
    await assertFails(getDoc(doc(as(env, 'bob'), 'rateLimits/alice')));
  });

  it('отметка — только текущее время сервера и не чаще лимита', async () => {
    const ref = doc(as(env, 'alice'), 'rateLimits/alice');
    await assertFails(setDoc(ref, { createCourse: ago(1000) }));
    await assertSucceeds(setDoc(ref, { createCourse: serverTimestamp() }));
    // Прошло меньше 30 с — повторная отметка отклоняется.
    await assertFails(setDoc(ref, { createCourse: serverTimestamp() }, { merge: true }));
    await seed(env, 'rateLimits/alice', { createCourse: ago(31), addComment: ago(10) });
    await assertSucceeds(setDoc(ref, { createCourse: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(ref, { addComment: serverTimestamp() }, { merge: true }));
    await seed(env, 'rateLimits/alice', { addComment: ago(16) });
    await assertSucceeds(setDoc(ref, { addComment: serverTimestamp() }, { merge: true }));
  });

  it('отметку нельзя удалить, сбросить, откатить назад или завести чужую', async () => {
    await seed(env, 'rateLimits/alice', { createCourse: ago(5) });
    const ref = doc(as(env, 'alice'), 'rateLimits/alice');
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(ref, { createCourse: null }));
    await assertFails(setDoc(ref, { createCourse: ago(100) }));
    await assertFails(setDoc(ref, { createCourse: ago(5), other: 1 }));
    await assertFails(setDoc(doc(as(env, 'bob'), 'rateLimits/alice'), { createCourse: serverTimestamp() }));
  });
});
