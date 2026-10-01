/**
 * Подписки на авторов и лента их курсов (v2). follows/{followerId}_{authorId};
 * лента — опубликованные курсы этих авторов (запрос «authorId in […]» без
 * составного индекса), сортировка в браузере.
 */
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { COLLECTIONS } from '../../shared/schema.js';
import { db } from './firebase.js';

const followRef = (followerId, authorId) => doc(db, COLLECTIONS.FOLLOWS, `${followerId}_${authorId}`);
const followsCol = () => collection(db, COLLECTIONS.FOLLOWS);

/** Подписан ли followerId на authorId (живая подписка). */
export function subscribeToFollowing(followerId, authorId, onData, onError) {
  return onSnapshot(followRef(followerId, authorId), (snap) => onData(snap.exists()), onError);
}

export function follow(followerId, authorId) {
  return setDoc(followRef(followerId, authorId), { followerId, authorId, createdAt: serverTimestamp() });
}

export function unfollow(followerId, authorId) {
  return deleteDoc(followRef(followerId, authorId));
}

export async function countFollowers(authorId) {
  return (await getCountFromServer(query(followsCol(), where('authorId', '==', authorId)))).data().count;
}

/** На кого подписан пользователь: [authorId]. */
export function subscribeToFollowedAuthors(followerId, onData, onError) {
  return onSnapshot(
    query(followsCol(), where('followerId', '==', followerId), limit(200)),
    (snap) => onData(snap.docs.map((d) => d.data().authorId)),
    onError,
  );
}

const IN_LIMIT = 30;
const FEED_MAX = 60;
const millis = (ts) => ts?.toMillis?.() ?? 0;

/** Лента: опубликованные курсы авторов, новые первыми. */
export async function loadFeed(authorIds) {
  const chunks = [];
  for (let i = 0; i < authorIds.length; i += IN_LIMIT) chunks.push(authorIds.slice(i, i + IN_LIMIT));
  const snaps = await Promise.all(
    chunks.map((ids) => getDocs(query(collection(db, COLLECTIONS.PUBLIC_COURSES), where('authorId', 'in', ids), limit(FEED_MAX)))),
  );
  return snaps
    .flatMap((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    .sort((a, b) => millis(b.publishedAt) - millis(a.publishedAt))
    .slice(0, FEED_MAX);
}
