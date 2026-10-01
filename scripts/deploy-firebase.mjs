// CI: деплой правил Firestore, индексов и сайта через REST API Firebase
// с ключом сервисного аккаунта Firebase Admin SDK.
//
// Почему не `firebase deploy`: CLI указывает проект как quota project
// (заголовок x-goog-user-project), а для этого ключу Admin SDK нужна роль
// Service Usage Consumer, которой у него по умолчанию нет. Те же API без
// этого заголовка ключу доступны, так что пользователю не нужно ничего
// настраивать в Google Cloud.
//
// Запуск: node scripts/deploy-firebase.mjs [rules] [indexes] [hosting]
// (без аргументов — всё). Нужны GOOGLE_APPLICATION_CREDENTIALS и
// FIREBASE_PROJECT_ID; для hosting — собранная папка dist.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { initializeApp } from 'firebase-admin/app';

const project = process.env.FIREBASE_PROJECT_ID;
if (!project) throw new Error('FIREBASE_PROJECT_ID не задан');
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['rules', 'indexes', 'hosting'];

const app = initializeApp({ projectId: project });
const token = (await app.options.credential.getAccessToken()).access_token;

async function api(method, url, body, { okStatuses = [] } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && !okStatuses.includes(res.status)) {
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 1500)}`);
  }
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

async function deployRules() {
  const content = readFileSync('firestore.rules', 'utf8');
  const base = `https://firebaserules.googleapis.com/v1/projects/${project}`;
  const { data: ruleset } = await api('POST', `${base}/rulesets`, {
    source: { files: [{ name: 'firestore.rules', content }] },
  });
  const releaseName = `projects/${project}/releases/cloud.firestore`;
  const release = { name: releaseName, rulesetName: ruleset.name };
  const updated = await api('PATCH', `${base}/releases/cloud.firestore`, { release }, { okStatuses: [404] });
  if (updated.status === 404) await api('POST', `${base}/releases`, release);
  console.log(`Правила Firestore опубликованы (${ruleset.name}).`);
}

async function deployIndexes() {
  const { indexes = [], fieldOverrides = [] } = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));
  const db = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
  let created = 0;
  for (const { collectionGroup, queryScope, fields } of indexes) {
    const { status } = await api('POST', `${db}/collectionGroups/${collectionGroup}/indexes`, { queryScope, fields }, { okStatuses: [409] });
    if (status !== 409) created += 1;
  }
  for (const { collectionGroup, fieldPath, indexes: fieldIndexes = [] } of fieldOverrides) {
    const indexConfig = {
      indexes: fieldIndexes.map(({ queryScope, ...mode }) => ({ queryScope, fields: [{ fieldPath, ...mode }] })),
    };
    await api('PATCH', `${db}/collectionGroups/${collectionGroup}/fields/${fieldPath}?updateMask=indexConfig`, { indexConfig });
  }
  console.log(`Индексы: создано ${created}, уже были ${indexes.length - created}; настроек полей: ${fieldOverrides.length}. Новые индексы строятся несколько минут.`);
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function hostingConfig(hosting) {
  return {
    rewrites: (hosting.rewrites ?? []).map((r) => ({ glob: r.source, path: r.destination })),
    // Источник — glob (source) или регулярное выражение RE2 (regex), как в firebase.json.
    headers: (hosting.headers ?? []).map((h) => ({
      ...(h.regex ? { regex: h.regex } : { glob: h.source }),
      headers: Object.fromEntries(h.headers.map(({ key, value }) => [key, value])),
    })),
  };
}

async function deployHosting() {
  const { hosting } = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const base = 'https://firebasehosting.googleapis.com/v1beta1';
  const { data: sites } = await api('GET', `${base}/projects/${project}/sites`);
  const site = (sites.sites ?? []).find((s) => s.type === 'DEFAULT_SITE') ?? sites.sites?.[0];
  if (!site) throw new Error('В проекте нет сайта Firebase Hosting');
  const siteName = site.name.split('/').pop();

  const files = new Map();
  for (const path of listFiles(hosting.public)) {
    const gz = gzipSync(readFileSync(path), { level: 9 });
    const hash = createHash('sha256').update(gz).digest('hex');
    files.set(`/${relative(hosting.public, path).split(sep).join('/')}`, { gz, hash });
  }

  const { data: version } = await api('POST', `${base}/sites/${siteName}/versions`, { config: hostingConfig(hosting) });
  const { data: populated } = await api('POST', `${base}/${version.name}:populateFiles`, {
    files: Object.fromEntries([...files].map(([path, { hash }]) => [path, hash])),
  });
  const byHash = new Map([...files.values()].map((f) => [f.hash, f.gz]));
  for (const hash of populated.uploadRequiredHashes ?? []) {
    const res = await fetch(`${populated.uploadUrl}/${hash}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: byHash.get(hash),
    });
    if (!res.ok) throw new Error(`Загрузка файла ${hash} → ${res.status}: ${await res.text()}`);
  }
  await api('PATCH', `${base}/${version.name}?updateMask=status`, { status: 'FINALIZED' });
  await api('POST', `${base}/sites/${siteName}/releases?versionName=${encodeURIComponent(version.name)}`, {});
  console.log(`Сайт опубликован: ${site.defaultUrl ?? `https://${siteName}.web.app`} (файлов: ${files.size}, загружено: ${(populated.uploadRequiredHashes ?? []).length}).`);
}

const steps = { rules: deployRules, indexes: deployIndexes, hosting: deployHosting };
for (const target of targets) {
  if (!steps[target]) throw new Error(`Неизвестная цель: ${target}`);
  await steps[target]();
}
