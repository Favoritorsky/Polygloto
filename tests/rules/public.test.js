import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { anon, as, createEnv, seed, userProfile } from './helpers.js';

let env;
beforeAll(async () => {
  env = await createEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env, 'users/alice', userProfile());
  await seed(env, 'users/admin', userProfile({ role: 'admin' }));
  await seed(env, 'publicCourses/c1', { authorId: 'alice', title: 'Курс', likesCount: 0, dislikesCount: 0 });
  await seed(env, 'publicCourses/c1/lessons/l1', { title: 'Урок', blocks: [] });
  await seed(env, 'publicCourses/c1/secret/x', { a: 1 });
});

describe('publicCourses', () => {
  it('читают все, включая анонимов', async () => {
    await assertSucceeds(getDoc(doc(anon(env), 'publicCourses/c1')));
    await assertSucceeds(getDocs(collection(anon(env), 'publicCourses')));
    await assertSucceeds(getDoc(doc(anon(env), 'publicCourses/c1/lessons/l1')));
  });

  it('неизвестные подколлекции не читаются', async () => {
    await assertFails(getDoc(doc(anon(env), 'publicCourses/c1/secret/x')));
  });

  it('снимок пишет только админ; автор и читатели — нет', async () => {
    await assertFails(setDoc(doc(as(env, 'alice'), 'publicCourses/c2'), { authorId: 'alice', title: 'Сам опубликовал' }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'publicCourses/c1'), { title: 'Подмена' }));
    await assertFails(updateDoc(doc(as(env, 'alice'), 'publicCourses/c1'), { likesCount: 1000 }));
    await assertFails(setDoc(doc(as(env, 'alice'), 'publicCourses/c1/lessons/l1'), { title: 'x', blocks: [] }));
    await assertFails(setDoc(doc(as(env, 'admin'), 'publicCourses/c1/secret/x'), { a: 1 }));
    await assertSucceeds(setDoc(doc(as(env, 'admin'), 'publicCourses/c1/lessons/l1'), { title: 'x', blocks: [] }));
    await assertSucceeds(updateDoc(doc(as(env, 'admin'), 'publicCourses/c1'), { title: 'Новая версия' }));
  });

  it('имя автора в снимке меняется только вместе с именем в его профиле', async () => {
    const db = as(env, 'alice');
    await assertFails(updateDoc(doc(db, 'publicCourses/c1'), { authorName: 'Кто-то другой' }));
    const batch = writeBatch(db);
    batch.update(doc(db, 'users/alice'), { displayName: 'Алиса' });
    batch.update(doc(db, 'publicCourses/c1'), { authorName: 'Алиса' });
    await assertSucceeds(batch.commit());
    const bad = writeBatch(db);
    bad.update(doc(db, 'users/alice'), { displayName: 'Алиса Вторая' });
    bad.update(doc(db, 'publicCourses/c1'), { authorName: 'Не то имя' });
    await assertFails(bad.commit());
    // Чужой курс так не переименовать.
    await seed(env, 'users/bob', userProfile());
    const bobDb = as(env, 'bob');
    const other = writeBatch(bobDb);
    other.update(doc(bobDb, 'users/bob'), { displayName: 'Боб' });
    other.update(doc(bobDb, 'publicCourses/c1'), { authorName: 'Боб' });
    await assertFails(other.commit());
  });

  it('снять с публикации может автор или админ; содержимое снимка — тоже', async () => {
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'publicCourses/c1/lessons/l1')));
    await assertFails(deleteDoc(doc(as(env, 'bob'), 'publicCourses/c1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'publicCourses/c1/lessons/l1')));
    await assertSucceeds(deleteDoc(doc(as(env, 'alice'), 'publicCourses/c1')));
  });
});

describe('catalogMeta', () => {
  it('список языков читают все, а пишет только админ', async () => {
    await seed(env, 'catalogMeta/languages', { items: [] });
    await assertSucceeds(getDoc(doc(anon(env), 'catalogMeta/languages')));
    await assertFails(setDoc(doc(as(env, 'alice'), 'catalogMeta/languages'), { items: [{ key: 'x', name: 'x', count: 999 }] }));
    await assertSucceeds(setDoc(doc(as(env, 'admin'), 'catalogMeta/languages'), { items: [] }));
  });
});
