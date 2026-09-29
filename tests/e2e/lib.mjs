// Помощники e2e-сценариев: браузер Playwright против `npm run emulators` + `npm run dev:emu`.
import { chromium } from 'playwright';

export const BASE = process.env.E2E_BASE_URL || 'http://localhost:5173';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const PROJECT = 'demo-polygloto';

export async function launch() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  return browser;
}

export async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.errors = errors;
  return page;
}

export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
}

export async function register(page, { name, email, password = 'password123' }) {
  await page.goto(`${BASE}/register`);
  await page.getByLabel('Отображаемое имя').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByLabel('Повторите пароль').fill(password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await page.waitForURL('**/account?welcome=1');
}

/** Подтверждает email через REST эмулятора Auth (как переход по ссылке из письма). */
export async function verifyEmail(email) {
  const res = await fetch(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = await res.json();
  const code = oobCodes.reverse().find((c) => c.email === email && c.requestType === 'VERIFY_EMAIL');
  if (!code) throw new Error(`no verification code for ${email}`);
  await fetch(code.oobLink.replace('127.0.0.1:9099', '127.0.0.1:9099'));
}

/** Назначает роль напрямую в эмуляторе Firestore (аналог правки в консоли). */
export async function setRole(uid, role) {
  const url = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=role`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: role } } }),
  });
  if (!res.ok) throw new Error(`setRole failed: ${res.status}`);
}

export async function uidOf(email) {
  const res = await fetch(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ expression: [{ email }], returnUserInfo: true }),
  });
  const data = await res.json();
  return data.userInfo?.[0]?.localId;
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}
