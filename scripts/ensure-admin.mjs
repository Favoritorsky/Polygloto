// CI: выдаёт роль admin пользователю с email из секрета ADMIN_EMAIL.
// Нужен сервисный аккаунт (GOOGLE_APPLICATION_CREDENTIALS). Если человек ещё
// не зарегистрировался на сайте, просто сообщает об этом: workflow
// запускается по расписанию и выдаст роль после регистрации.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const emails = (process.env.ADMIN_EMAIL ?? '').split(',').map((e) => e.trim()).filter(Boolean);
if (emails.length === 0) {
  console.log('ADMIN_EMAIL не задан — пропускаю назначение администратора.');
  process.exit(0);
}

initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore();

for (const email of emails) {
  let user;
  try {
    user = await getAuth().getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log('Администратор ещё не зарегистрирован на сайте — роль будет выдана после регистрации.');
      continue;
    }
    throw error;
  }
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('Профиль администратора ещё не создан — роль будет выдана при следующем запуске.');
  } else if (snap.data().role === 'admin') {
    console.log('Роль admin уже выдана.');
  } else {
    await ref.update({ role: 'admin' });
    console.log('Роль admin выдана.');
  }
}
