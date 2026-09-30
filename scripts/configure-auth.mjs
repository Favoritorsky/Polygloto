// CI: настройки писем Firebase Authentication через Identity Toolkit Admin API.
// Письма по умолчанию — на русском, отправитель — «Polygloto».
//
// Запуск: node scripts/configure-auth.mjs [--diagnose | --smtp-on | --smtp-off]
//   (без флага) — язык, имя отправителя, темы и текст писем; способ отправки не меняет;
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
  for (const name of ['verifyEmailTemplate', 'resetPasswordTemplate', 'changeEmailTemplate']) console.log(`${name}:`, JSON.stringify(pick(sendEmail[name])));
  // %APP_NAME% в стандартных темах писем — «публичное имя» проекта (OAuth brand).
  const fb = await api('GET', `https://firebase.googleapis.com/v1beta1/projects/${project}`);
  console.log('Проект Firebase:', fb.ok ? JSON.stringify({ displayName: fb.data.displayName, projectNumber: fb.data.projectNumber }) : fb.status);
  if (fb.ok) {
    const brands = await api('GET', `https://iap.googleapis.com/v1/projects/${fb.data.projectNumber}/brands`);
    console.log('OAuth brand:', brands.ok ? JSON.stringify((brands.brands ?? brands.data.brands ?? []).map((b) => b.applicationTitle)) : `${brands.status} ${JSON.stringify(brands.data).slice(0, 200)}`);
  }
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

// Все письма подписаны Polygloto: имя отправителя, тема и текст.
// %LINK%, %EMAIL%, %NEW_EMAIL% подставляет Firebase.
const letter = (title, text, action, link = '%LINK%') => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
<h2 style="color:#4f46e5;margin:0 0 16px">Polygloto</h2>
<p style="font-size:16px;margin:0 0 12px"><b>${title}</b></p>
<p style="margin:0 0 20px">${text}</p>
<p style="margin:0 0 24px"><a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${action}</a></p>
<p style="font-size:13px;color:#6b7280;margin:0">Если кнопка не открывается, скопируйте ссылку в браузер:<br>${link}</p>
<p style="font-size:13px;color:#6b7280;margin:16px 0 0">Если вы не запрашивали это письмо, просто проигнорируйте его.<br>Команда Polygloto — интерактивные самоучители любых языков мира</p>
</div>`;
const templates = {
  verifyEmailTemplate: {
    subject: 'Polygloto: подтвердите адрес почты',
    body: letter('Подтвердите адрес почты', 'Здравствуйте! Вы зарегистрировались в Polygloto с адресом %EMAIL%. Нажмите кнопку ниже, чтобы подтвердить почту.', 'Подтвердить почту'),
  },
  resetPasswordTemplate: {
    subject: 'Polygloto: сброс пароля',
    body: letter('Сброс пароля', 'Здравствуйте! Мы получили запрос на сброс пароля для аккаунта Polygloto %EMAIL%. Нажмите кнопку ниже, чтобы задать новый пароль.', 'Задать новый пароль'),
  },
  changeEmailTemplate: {
    subject: 'Polygloto: адрес почты изменён',
    body: letter('Адрес почты изменён', 'Адрес почты вашего аккаунта Polygloto изменён на %NEW_EMAIL%. Если это сделали не вы, нажмите кнопку ниже, чтобы вернуть прежний адрес %EMAIL%.', 'Вернуть прежний адрес'),
  },
};

// Firebase разрешает менять тему и текст только некоторых писем
// (для подтверждения почты и сброса пароля — EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED),
// поэтому каждое письмо настраиваем отдельно: сначала целиком, иначе только имя отправителя.
async function applyTemplate(name, fields) {
  const mask = Object.keys(fields).map((field) => `notification.sendEmail.${name}.${field}`).join(',');
  return api('PATCH', `${configUrl}?updateMask=${mask}`, { notification: { sendEmail: { [name]: fields } } });
}

const locale = await api('PATCH', `${configUrl}?updateMask=notification.defaultLocale`, { notification: { defaultLocale: 'ru' } });
if (!locale.ok) console.log(`::warning::Не удалось задать язык писем (${locale.status}).`);
for (const [name, { subject, body }] of Object.entries(templates)) {
  const full = await applyTemplate(name, { senderDisplayName: 'Polygloto', subject, body, bodyFormat: 'HTML' });
  if (full.ok) {
    console.log(`${name}: отправитель, тема и текст Polygloto.`);
    continue;
  }
  const short = await applyTemplate(name, { senderDisplayName: 'Polygloto' });
  console.log(short.ok
    ? `${name}: отправитель «Polygloto» (тему и текст Firebase менять не даёт: ${full.data.error?.message}).`
    : `::warning::${name}: не удалось обновить (${short.status}) ${JSON.stringify(short.data).slice(0, 200)}`);
}

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
