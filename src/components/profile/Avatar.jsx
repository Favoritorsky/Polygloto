import { useState } from 'react';
import styles from './Avatar.module.css';

const COLORS = ['#2a9d8f', '#e76f51', '#457b9d', '#6a4c93', '#8a5a00', '#b5838d'];

function colorFor(seed = '') {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

/** Аватар пользователя; без фото (или если оно не загрузилось) — первая буква имени. */
export default function Avatar({ name, url, seed, size = 40 }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const letter = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (url && failedUrl !== url) {
    return <img className={styles.avatar} style={style} src={url} alt="" onError={() => setFailedUrl(url)} />;
  }
  return (
    <span className={styles.avatar} style={{ ...style, background: colorFor(seed ?? name) }} aria-hidden="true">
      {letter}
    </span>
  );
}
