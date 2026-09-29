// Правила Storage: аватары avatars/{uid}/{file}.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv } from './helpers.js';

// Эмулятор Storage проверяет firestore.get() в проекте, с которым запущены
// эмуляторы (demo-polygloto), а не в тестовом проекте правил. Поэтому
// профили для этих тестов пишутся туда, с уникальными uid, и удаляются после.
const MAIN_FIRESTORE = 'http://127.0.0.1:8080/v1/projects/demo-polygloto/databases/(default)/documents';
const run = Date.now().toString(36);
const ALICE = `st-alice-${run}`;
const BOB = `st-bob-${run}`;
const MALLORY = `st-mallory-${run}`;

async function mainDoc(method, uid, banned) {
  const res = await fetch(`${MAIN_FIRESTORE}/users/${uid}`, {
    method,
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: method === 'PATCH' ? JSON.stringify({ fields: { banned: { booleanValue: banned } } }) : undefined,
  });
  if (!res.ok) throw new Error(`mainDoc ${method} ${uid}: ${res.status}`);
}

let env;
beforeAll(async () => {
  env = await createEnv();
  await Promise.all([mainDoc('PATCH', ALICE, false), mainDoc('PATCH', BOB, false), mainDoc('PATCH', MALLORY, true)]);
});
afterAll(async () => {
  await Promise.all([ALICE, BOB, MALLORY].map((uid) => mainDoc('DELETE', uid)));
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearStorage();
});

const storageAs = (uid) => env.authenticatedContext(uid).storage();
const anonStorage = () => env.unauthenticatedContext().storage();
const png = (size = 100) => new Uint8Array(size);
const meta = (contentType) => ({ contentType });

async function seedFile(path) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), path), png(), meta('image/png'));
  });
}

describe('storage: аватары', () => {
  it('владелец загружает картинку в свою папку', async () => {
    await assertSucceeds(uploadBytes(ref(storageAs(ALICE), `avatars/${ALICE}/1700.jpg`), png(), meta('image/jpeg')));
    await assertSucceeds(uploadBytes(ref(storageAs(ALICE), `avatars/${ALICE}/a_b-1.webp`), png(), meta('image/webp')));
  });

  it('нельзя писать в чужую папку и анонимно', async () => {
    await assertFails(uploadBytes(ref(storageAs(ALICE), `avatars/${BOB}/1.jpg`), png(), meta('image/jpeg')));
    await assertFails(uploadBytes(ref(anonStorage(), `avatars/${ALICE}/1.jpg`), png(), meta('image/jpeg')));
  });

  it('только картинки допустимых типов и размера', async () => {
    const r = (name) => ref(storageAs(ALICE), `avatars/${ALICE}/${name}`);
    await assertFails(uploadBytes(r('x.svg'), png(), meta('image/svg+xml')));
    await assertFails(uploadBytes(r('x.jpg'), png(), meta('image/svg+xml')));
    await assertFails(uploadBytes(r('x.html'), png(), meta('text/html')));
    await assertFails(uploadBytes(r('x.jpg'), png(2 * 1024 * 1024 + 1), meta('image/jpeg')));
    await assertSucceeds(uploadBytes(r('x.jpg'), png(2 * 1024 * 1024), meta('image/jpeg')));
    await assertFails(uploadBytes(r('x.jpg'), new Uint8Array(0), meta('image/jpeg')));
  });

  it('вложенные пути и странные имена запрещены', async () => {
    await assertFails(uploadBytes(ref(storageAs(ALICE), `avatars/${ALICE}/sub/1.jpg`), png(), meta('image/jpeg')));
    await assertFails(uploadBytes(ref(storageAs(ALICE), `avatars/${ALICE}/.jpg`), png(), meta('image/jpeg')));
  });

  it('читают все; удаляет только владелец', async () => {
    await seedFile(`avatars/${ALICE}/1.png`);
    await assertSucceeds(getBytes(ref(anonStorage(), `avatars/${ALICE}/1.png`)));
    await assertFails(deleteObject(ref(storageAs(BOB), `avatars/${ALICE}/1.png`)));
    await assertFails(deleteObject(ref(anonStorage(), `avatars/${ALICE}/1.png`)));
    await assertSucceeds(deleteObject(ref(storageAs(ALICE), `avatars/${ALICE}/1.png`)));
  });

  it('заблокированный или без профиля не загружает', async () => {
    await assertFails(uploadBytes(ref(storageAs(MALLORY), `avatars/${MALLORY}/1.jpg`), png(), meta('image/jpeg')));
    await assertFails(uploadBytes(ref(storageAs('ghost'), 'avatars/ghost/1.jpg'), png(), meta('image/jpeg')));
  });

  it('остальные пути закрыты', async () => {
    await seedFile('private/x.png');
    await assertFails(getBytes(ref(storageAs(ALICE), 'private/x.png')));
    await assertFails(uploadBytes(ref(storageAs(ALICE), 'courses/c1/a.png'), png(), meta('image/png')));
  });
});
