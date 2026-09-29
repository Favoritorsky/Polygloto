import { afterEach, describe, expect, it } from 'vitest';
import { CALLABLES, ROLES } from '../../shared/schema.js';
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

describe('onUserCreated', () => {
  it('создаёт users/{uid} с ролью reader и без email', async () => {
    const c = client();
    const user = await signUp(c);
    const data = (await adminDb.doc(`users/${user.uid}`).get()).data();
    expect(data.role).toBe(ROLES.READER);
    expect(data.banned).toBe(false);
    expect(data.displayName).toMatch(/^Автор-/);
    expect(JSON.stringify(data)).not.toContain('@example.com');
  });
});

describe('syncRole', () => {
  it('не повышает роль без подтверждённой почты', async () => {
    const c = client();
    const user = await signUp(c);
    await expect(c.call(CALLABLES.SYNC_ROLE)).resolves.toEqual({ role: ROLES.READER });
    expect((await adminDb.doc(`users/${user.uid}`).get()).data().role).toBe(ROLES.READER);
  });

  it('повышает reader → user после подтверждения почты', async () => {
    const c = client();
    const user = await signUp(c, { verified: true });
    await expect(c.call(CALLABLES.SYNC_ROLE)).resolves.toEqual({ role: ROLES.USER });
    expect((await adminDb.doc(`users/${user.uid}`).get()).data().role).toBe(ROLES.USER);
  });

  it('не понижает и не меняет роль admin', async () => {
    const c = client();
    await signUp(c, { verified: true, role: ROLES.ADMIN });
    await expect(c.call(CALLABLES.SYNC_ROLE)).resolves.toEqual({ role: ROLES.ADMIN });
  });

  it('отклоняет анонимный вызов', async () => {
    const c = client();
    await expect(c.call(CALLABLES.SYNC_ROLE)).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  });
});
