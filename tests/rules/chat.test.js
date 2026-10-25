import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
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
  await seed(env, 'users/alice', userProfile({ displayName: 'Алиса' }));
  await seed(env, 'users/bob', userProfile({ displayName: 'Боб' }));
  await seed(env, 'users/admin', userProfile({ role: 'admin', displayName: 'Админ' }));
  await seed(env, 'users/banned', userProfile({ banned: true, displayName: 'Бан' }));
  await seed(env, 'publicCourses/ark', { authorId: 'bob', title: 'Аркавок', language: 'Аркавок', languageLower: 'аркавок' });
  await seed(env, 'publicCourses/sh', { authorId: 'bob', title: 'Сербский', language: 'Сербский/хорватский', languageLower: 'сербский/хорватский' });
  await seed(env, 'languageChats/lang-аркавок/messages/m1', { authorId: 'bob', authorName: 'Боб', text: 'Авэ!', courseId: 'ark', createdAt: new Date() });
});

// Так сообщение пишет chatService.sendChatMessage: сообщение и отметка лимита одной записью.
function send(db, uid, { chat = 'lang-аркавок', name = 'Алиса', courseId = 'ark', text = 'Авэ, воз!', stamp = true, extra = {} } = {}) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, `languageChats/${chat}/messages`)), {
    authorId: uid,
    authorName: name,
    text,
    courseId,
    createdAt: serverTimestamp(),
    ...extra,
  });
  if (stamp) batch.set(doc(db, `rateLimits/${uid}`), { chatMessage: serverTimestamp() }, { merge: true });
  return batch.commit();
}

describe('чаты языков', () => {
  it('сообщения читают все, включая гостей', async () => {
    await assertSucceeds(getDocs(collection(anon(env), 'languageChats/lang-аркавок/messages')));
  });

  it('вошедший пишет в чат языка, на котором есть опубликованный курс', async () => {
    await assertSucceeds(send(as(env, 'alice'), 'alice'));
    // «/» в названии языка заменяется на «_».
    await assertSucceeds(send(as(env, 'bob'), 'bob', { chat: 'lang-сербский_хорватский', name: 'Боб', courseId: 'sh' }));
  });

  it('нельзя писать в чат чужого или несуществующего языка', async () => {
    await assertFails(send(as(env, 'alice'), 'alice', { chat: 'lang-клингонский' }));
    await assertFails(send(as(env, 'alice'), 'alice', { chat: 'lang-клингонский', courseId: 'нет-такого' }));
    await assertFails(send(as(env, 'alice'), 'alice', { chat: 'lang-аркавок', courseId: 'sh' }));
  });

  it('гость, забаненный и чужое имя — отказ', async () => {
    await assertFails(send(anon(env), 'alice'));
    await assertFails(send(as(env, 'banned'), 'banned', { name: 'Бан' }));
    await assertFails(send(as(env, 'alice'), 'alice', { name: 'Не Алиса' }));
    await assertFails(send(as(env, 'alice'), 'bob', { name: 'Боб' }));
  });

  it('текст: 1–1000 символов без пробелов по краям, без лишних полей', async () => {
    await assertFails(send(as(env, 'alice'), 'alice', { text: '' }));
    await assertFails(send(as(env, 'alice'), 'alice', { text: ' привет ' }));
    await assertFails(send(as(env, 'alice'), 'alice', { text: 'а'.repeat(1001) }));
    await assertFails(send(as(env, 'alice'), 'alice', { extra: { pinned: true } }));
    await assertSucceeds(send(as(env, 'alice'), 'alice', { text: 'а'.repeat(1000) }));
  });

  it('не чаще раза в 3 с и только с отметкой лимита', async () => {
    await assertFails(send(as(env, 'alice'), 'alice', { stamp: false }));
    await assertSucceeds(send(as(env, 'alice'), 'alice'));
    await assertFails(send(as(env, 'alice'), 'alice'));
  });

  it('сообщение не меняется; удаляют автор и админ', async () => {
    await assertFails(updateDoc(doc(as(env, 'bob'), 'languageChats/lang-аркавок/messages/m1'), { text: 'Правка' }));
    await assertFails(deleteDoc(doc(as(env, 'alice'), 'languageChats/lang-аркавок/messages/m1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'admin'), 'languageChats/lang-аркавок/messages/m1')));
    await seed(env, 'languageChats/lang-аркавок/messages/m2', { authorId: 'bob', authorName: 'Боб', text: 'x', courseId: 'ark', createdAt: new Date() });
    await assertSucceeds(deleteDoc(doc(as(env, 'bob'), 'languageChats/lang-аркавок/messages/m2')));
  });
});
