/**
 * Локальный курс («Открыть файл курса»): один курс в IndexedDB этого браузера.
 * В Firestore ничего не пишется — так файл можно проходить и править без
 * входа, без интернета и без расхода дневных лимитов базы.
 */
const DB_NAME = 'polygloto-local';
const STORE = 'courses';
const KEY = 'current';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Сохранённый курс или null. */
export function loadLocalCourse() {
  return run('readonly', (store) => store.get(KEY)).then((value) => value ?? null);
}

export function saveLocalCourse(course) {
  return run('readwrite', (store) => store.put(course, KEY));
}

export function clearLocalCourse() {
  return run('readwrite', (store) => store.delete(KEY));
}
