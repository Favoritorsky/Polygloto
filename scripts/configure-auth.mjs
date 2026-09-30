// CI: настройки писем Firebase Authentication через Identity Toolkit Admin API.
// Письма по умолчанию — на русском, отправитель — «Polygloto».
// Если заданы SMTP_USER и SMTP_PASSWORD (пароль приложения Gmail), письма
// отправляются через этот ящик Gmail, а не с общего адреса firebaseapp.com,
// который почтовые сервисы часто считают спамом.
// Запуск: node scripts/configure-auth.mjs [--diagnose]
// --diagnose дополнительно печатает текущие настройки писем и состояние
// аккаунта администратора (без email), ничего не меняя.
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

const smtpUser = process.env.SMTP_USER?.trim();
const smtpPassword = process.env.SMTP_PASSWORD?.replace(/\s+/g, '');
if (smtpUser && smtpPassword) {
  const smtp = {
    senderEmail: smtpUser,
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    username: smtpUser,
    password: smtpPassword,
    securityMode: 'SSL',
  };
  const smtpRes = await api(
    'PATCH',
    `${configUrl}?updateMask=notification.sendEmail.method,notification.sendEmail.smtp`,
    { notification: { sendEmail: { method: 'CUSTOM_SMTP', smtp } } },
  );
  if (smtpRes.ok) console.log(`Письма Auth отправляются через SMTP ${smtp.host} от ${smtpUser.replace(/^(.).*@/, '$1***@')}.`);
  else {
    console.log(`::error::Не удалось включить свой SMTP (${smtpRes.status}): ${JSON.stringify(smtpRes.data).slice(0, 300)}`);
    process.exit(1);
  }
} else {
  console.log('SMTP_USER/SMTP_PASSWORD не заданы — письма уходят со стандартного адреса Firebase.');
}
