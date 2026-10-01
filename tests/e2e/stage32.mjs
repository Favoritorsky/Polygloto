// Правки 3, задача 5: аудит вёрстки. На всех основных страницах (гость и
// вошедший админ) на телефоне (360 px) и компьютере (1280 px) страница не
// прокручивается вбок и ничего не выходит за край экрана.
// SHOTS=/папка — сохранить скриншоты для ручной проверки отступов.
import { BASE, assert, launch, register, setRole, uidOf, uniqueEmail } from './lib.mjs';
import { FieldValue, Timestamp, adminDb, seedPublishedCourse } from './seed.mjs';

const LONG = 'Очень длинное название курса, чтобы проверить перенос строк в карточках и заголовках';
const blocks = [
  { type: 'heading', level: 2, children: [{ text: LONG }] },
  { type: 'paragraph', children: [{ text: `${LONG}. Hola, ¿qué tal? Donaudampfschifffahrtsgesellschaftskapitän.` }] },
  {
    type: 'table',
    headerRow: true,
    headerColumn: true,
    rows: [{ cells: ['', 'singular', 'plural', 'formal', 'informal'] }, { cells: ['1', 'hablo', 'hablamos', 'usted habla', 'tú hablas'] }],
  },
  {
    type: 'task',
    id: 't1',
    taskType: 'multiple_choice',
    data: {
      question: 'Hola?',
      options: [
        { id: 'a', text: 'привет' },
        { id: 'b', text: 'пока' },
      ],
      correctOptionId: 'a',
    },
  },
];
const dictionary = ['hola', 'adiós', 'casa', 'perro', 'gato'].map((w, i) => ({
  id: `w${i}`,
  word: w,
  translation: `${LONG.slice(0, 20)} ${i}`,
}));
const courseId = await seedPublishedCourse({
  title: `${LONG} ${Date.now().toString(36)}`,
  lessons: [{ id: 'l1', title: LONG, blocks }],
  dictionary,
});

const browser = await launch();
const problems = [];
async function audit(page, label) {
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth - vw;
    // Ближайший предок, который обрезает или прокручивает содержимое.
    const clipper = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return p;
      }
      return null;
    };
    // Намеренная прокрутка вбок: вкладки, меню, широкие таблицы.
    const intended = (p) => /tabs|nav|scroll/i.test(String(p.className));
    const out = [...document.body.querySelectorAll('*')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (!(r.width > 0 && r.height > 0 && s.visibility !== 'hidden')) return false;
        const c = clipper(el);
        if (!c) return r.right > vw + 1 || r.left < -1;
        if (intended(c) || c.tagName === 'BODY' || c.tagName === 'HTML') return false;
        const box = c.getBoundingClientRect();
        return r.right > box.right + 1 || r.left < box.left - 1;
      })
      .slice(0, 4)
      .map(
        (el) => `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}">${(el.textContent ?? '').trim().slice(0, 30)}`,
      );
    return { scroll, out };
  });
  if (result.scroll > 0 || result.out.length) problems.push(`${label}: прокрутка вбок ${result.scroll}px; ${result.out.join(' | ')}`);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${label.replace(/[^\w-]+/g, '_')}.png`, fullPage: false });
}

try {
  const email = uniqueEmail('stage32');
  const userContext = await browser.newContext({ locale: 'ru-RU' });
  const setup = await userContext.newPage();
  await register(setup, { name: 'Аудитор вёрстки с длинным именем', email });
  const uid = await uidOf(email);
  await setRole(uid, 'admin');
  const draft = adminDb.collection('courses').doc();
  await draft.set({
    authorId: uid,
    title: LONG,
    language: 'Испанский',
    description: LONG,
    categories: [],
    lessonOrder: ['l1'],
    referenceOrder: [],
    status: 'pending_review',
    rejectionReason: null,
    hasPublishedVersion: false,
    submittedAt: Timestamp.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await draft.collection('lessons').doc('l1').set({ title: LONG, blocks, updatedAt: Timestamp.now() });
  // Вход хранится в IndexedDB контекста — страницы пользователя открываем в нём же.
  await setup.close();

  const guestPages = [
    '/',
    '/catalog',
    '/demo',
    '/demo?tab=dictionary',
    `/course/${courseId}`,
    `/course/${courseId}?tab=dictionary`,
    `/course/${courseId}?tab=comments`,
    `/course/${courseId}/games`,
    '/leaderboard',
    '/login',
    '/register',
    '/forgot-password',
    '/nope',
  ];
  const userPages = [
    '/',
    '/account',
    '/my-courses',
    `/courses/${draft.id}/edit`,
    '/admin',
    `/admin/review/${draft.id}`,
    '/review',
    '/progress',
    '/feed',
    `/users/${uid}`,
    `/course/${courseId}`,
  ];
  const editorTabs = ['Справочник', 'Словарь', 'Статистика', 'Настройки курса'];

  for (const width of [360, 1280]) {
    const guest = await browser.newPage({ viewport: { width, height: 800 }, locale: 'ru-RU' });
    for (const path of guestPages) {
      await guest.goto(`${BASE}${path}`);
      await audit(guest, `${width}-guest${path}`);
    }
    await guest.close();
    const user = await userContext.newPage();
    await user.setViewportSize({ width, height: 800 });
    for (const path of userPages) {
      await user.goto(`${BASE}${path}`);
      await audit(user, `${width}-user${path}`);
    }
    await user.goto(`${BASE}/courses/${draft.id}/edit`);
    for (const tab of editorTabs) {
      await user.getByRole('tab', { name: tab }).click();
      await audit(user, `${width}-editor-${tab}`);
    }
    await user.goto(`${BASE}/admin`);
    for (const tab of ['Все курсы', 'Пользователи']) {
      await user.getByRole('tab', { name: tab }).click();
      await audit(user, `${width}-admin-${tab}`);
    }
    await user.goto(`${BASE}/my-courses`);
    await user.getByRole('button', { name: '+ Новый курс' }).click();
    await audit(user, `${width}-modal-new-course`);
    await user.close();
  }
  assert(problems.length === 0, `вёрстка без переполнений на всех страницах${problems.length ? `:\n${problems.join('\n')}` : ''}`);
} finally {
  await browser.close();
}
console.log('stage32 OK');
