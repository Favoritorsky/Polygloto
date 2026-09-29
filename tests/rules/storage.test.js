// Правила Storage: аватары avatars/{uid}/{file}.
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
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
    await assertSucceeds(uploadBytes(ref(storageAs('alice'), 'avatars/alice/1700.jpg'), png(), meta('image/jpeg')));
    await assertSucceeds(uploadBytes(ref(storageAs('alice'), 'avatars/alice/a_b-1.webp'), png(), meta('image/webp')));
  });

  it('нельзя писать в чужую папку и анонимно', async () => {
    await assertFails(uploadBytes(ref(storageAs('alice'), 'avatars/bob/1.jpg'), png(), meta('image/jpeg')));
    await assertFails(uploadBytes(ref(anonStorage(), 'avatars/alice/1.jpg'), png(), meta('image/jpeg')));
  });

  it('только картинки допустимых типов и размера', async () => {
    const r = (name) => ref(storageAs('alice'), `avatars/alice/${name}`);
    await assertFails(uploadBytes(r('x.svg'), png(), meta('image/svg+xml')));
    await assertFails(uploadBytes(r('x.jpg'), png(), meta('image/svg+xml')));
    await assertFails(uploadBytes(r('x.html'), png(), meta('text/html')));
    await assertFails(uploadBytes(r('x.jpg'), png(2 * 1024 * 1024 + 1), meta('image/jpeg')));
    await assertSucceeds(uploadBytes(r('x.jpg'), png(2 * 1024 * 1024), meta('image/jpeg')));
    await assertFails(uploadBytes(r('x.jpg'), new Uint8Array(0), meta('image/jpeg')));
  });

  it('вложенные пути и странные имена запрещены', async () => {
    await assertFails(uploadBytes(ref(storageAs('alice'), 'avatars/alice/sub/1.jpg'), png(), meta('image/jpeg')));
    await assertFails(uploadBytes(ref(storageAs('alice'), 'avatars/alice/.jpg'), png(), meta('image/jpeg')));
  });

  it('читают все; удаляет только владелец', async () => {
    await seedFile('avatars/alice/1.png');
    await assertSucceeds(getBytes(ref(anonStorage(), 'avatars/alice/1.png')));
    await assertFails(deleteObject(ref(storageAs('bob'), 'avatars/alice/1.png')));
    await assertFails(deleteObject(ref(anonStorage(), 'avatars/alice/1.png')));
    await assertSucceeds(deleteObject(ref(storageAs('alice'), 'avatars/alice/1.png')));
  });

  it('остальные пути закрыты', async () => {
    await seedFile('private/x.png');
    await assertFails(getBytes(ref(storageAs('alice'), 'private/x.png')));
    await assertFails(uploadBytes(ref(storageAs('alice'), 'courses/c1/a.png'), png(), meta('image/png')));
  });
});
