// CI: настройки писем Firebase Authentication через Identity Toolkit Admin API.
// Письма по умолчанию — на русском, отправитель — «Polygloto».
//
// Запуск: node scripts/configure-auth.mjs [--diagnose | --smtp-on | --smtp-off]
//   (без флага) — только язык и имя отправителя; способ отправки не меняет;
//   --diagnose  — печатает настройки писем и состояние аккаунта админа;
//   --smtp-on   — включает отправку через ящик SMTP_USER / SMTP_PASSWORD
//                 (пароль приложения Gmail) и сразу шлёт через Firebase
//                 письмо сброса пароля на ADMIN_EMAIL как проверку;
//   --smtp-off  — возвращает стандартную отправку Firebase.
// Проверить сам SMTP из GitHub Actions нельзя: раннеры не пускают на порты
// почтовых серверов, поэтому проверка — настоящее письмо через Firebase.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const project = process.env.FIREBASE_PROJECT_ID;
const diagnose = process.argv.includes('--diagnose');
const app = initializeApp({ projectId: project });
const token = (await app.options.credential.getAccessToken()).access_token;
const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : {} };
}

const current = await api('GET', configUrl);
if (!current.ok) throw new Error(`Не удалось прочитать настройки Auth: ${current.status} ${JSON.stringify(current.data)}`);
const sendEmail = current.data.notification?.sendEmail ?? {};

if (diagnose) {
  const pick = (t = {}) => ({ senderLocalPart: t.senderLocalPart, senderDisplayName: t.senderDisplayName, subject: t.subject, customized: t.customized });
  console.log('Язык писем:', current.data.notification?.defaultLocale ?? '(не задан)');
  console.log('Способ отправки:', sendEmail.method, sendEmail.smtp ? `(SMTP ${sendEmail.smtp.host}:${sendEmail.smtp.port})` : '');
  console.log('Шаблон подтверждения:', JSON.stringify(pick(sendEmail.verifyEmailTemplate)));
  console.log('Email/Password:', JSON.stringify(current.data.signIn?.email ?? {}));
  const email = (process.env.ADMIN_EMAIL ?? '').split(',')[0]?.trim();
  if (email) {
    try {
      const user = await getAuth().getUserByEmail(email);
      console.log('Админ: подтверждён =', user.emailVerified, '| создан', user.metadata.creationTime, '| домен почты', email.split('@')[1]);
    } catch (error) {
      console.log('Админ не найден:', error.code);
    }
  }
  process.exit(0);
}

const template = sendEmail.verifyEmailTemplate ?? {};
const patch = {
  notification: {
    defaultLocale: 'ru',
    sendEmail: { verifyEmailTemplate: { ...template, senderDisplayName: 'Polygloto' } },
  },
};
const mask = 'notification.defaultLocale,notification.sendEmail.verifyEmailTemplate.senderDisplayName';
const res = await api('PATCH', `${configUrl}?updateMask=${mask}`, patch);
if (res.ok) console.log('Письма Auth: язык ru, отправитель «Polygloto».');
else console.log(`::warning::Не удалось обновить настройки писем (${res.status}): ${JSON.stringify(res.data).slice(0, 300)}`);

async function setMethod(sendEmailPatch, mask) {
  const res = await api('PATCH', `${configUrl}?updateMask=${mask}`, { notification: { sendEmail: sendEmailPatch } });
  if (!res.ok) throw new Error(`Не удалось изменить способ отправки: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
}

if (process.argv.includes('--smtp-off')) {
  await setMethod({ method: 'DEFAULT' }, 'notification.sendEmail.method');
  console.log('Письма снова уходят со стандартного адреса Firebase.');
}

if (process.argv.includes('--smtp-on')) {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.replace(/\s+/g, '');
  if (!user || !password) throw new Error('Секреты SMTP_USER и SMTP_PASSWORD не заданы');
  const port = Number(process.env.SMTP_PORT) || 465;
  const smtp = {
    senderEmail: user,
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    username: user,
    password,
    securityMode: port === 465 ? 'SSL' : 'START_TLS',
  };
  await setMethod({ method: 'CUSTOM_SMTP', smtp }, 'notification.sendEmail.method,notification.sendEmail.smtp');
  console.log(`Отправка через SMTP ${smtp.host}:${port} (${smtp.securityMode}) от ${user.replace(/^(.).*@/, '$1***@')}, длина пароля ${password.length}.`);

  const email = (process.env.ADMIN_EMAIL ?? '').split(',')[0]?.trim();
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (email && key) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
    });
    const body = await res.text();
    console.log(res.ok ? 'Firebase принял тестовое письмо (сброс пароля) на адрес администратора.' : `::error::Firebase не отправил письмо: ${res.status} ${body.slice(0, 300)}`);
    if (!res.ok) {
      await setMethod({ method: 'DEFAULT' }, 'notification.sendEmail.method');
      console.log('Вернул стандартную отправку Firebase.');
      process.exit(1);
    }
  }
}
