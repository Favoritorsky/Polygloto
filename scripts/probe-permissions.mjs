// CI-диагностика: какие API Firebase доступны ключу сервисного аккаунта.
import { initializeApp } from 'firebase-admin/app';

const project = process.env.FIREBASE_PROJECT_ID;
const app = initializeApp({ projectId: project });
const { access_token: token } = await app.options.credential.getAccessToken();

const probes = {
  'rules: list rulesets': `https://firebaserules.googleapis.com/v1/projects/${project}/rulesets?pageSize=1`,
  'rules: list releases': `https://firebaserules.googleapis.com/v1/projects/${project}/releases?pageSize=1`,
  'firestore: list indexes': `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/-/indexes`,
  'firestore: get database': `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`,
  'hosting: list sites': `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites`,
  'hosting: get default site': `https://firebasehosting.googleapis.com/v1beta1/sites/${project}/releases?pageSize=1`,
  'identity: get config': `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
};
for (const [name, url] of Object.entries(probes)) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();
  console.log(`${res.status} ${name}${res.ok ? '' : ` — ${body.slice(0, 200).replace(/\s+/g, ' ')}`}`);
}
