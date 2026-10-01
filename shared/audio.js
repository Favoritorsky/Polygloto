/**
 * Аудио в курсах (v2). Firebase Storage на тарифе Spark недоступен, поэтому:
 *  - загруженный файл хранится data URL в документе courses/{id}/audio/{audioId}
 *    (при одобрении копируется в publicCourses/{id}/audio), размер ограничен;
 *  - или внешняя ссылка, только https, только с разрешённых хостов и только
 *    на файл аудиоформата.
 * В контенте хранится ссылка на аудио (AudioRef): { kind: 'file', id } или
 * { kind: 'url', url }. Те же ограничения повторены в firestore.rules и CSP
 * (media-src в firebase.json).
 */

export const AUDIO_LIMITS = Object.freeze({
  /** Размер исходного файла. В base64 он вырастает на треть, документ Firestore — до 1 МиБ. */
  FILE_MAX_BYTES: 350 * 1024,
  /** Длина data URL (правила проверяют то же число). */
  DATA_URL_MAX: 480000,
  URL_MAX: 500,
  NAME_MAX: 120,
});

/** Разрешённые хосты внешних ссылок (Викисклад: записи Lingua Libre и др.). */
export const AUDIO_HOSTS = Object.freeze(['upload.wikimedia.org']);

/** MIME-типы, которые хранятся в data URL (совпадает с регулярным выражением в правилах). */
export const AUDIO_MIME = Object.freeze(['audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/wav']);

const MIME_ALIASES = Object.freeze({
  'audio/mp3': 'audio/mpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/aac': 'audio/mp4',
  'audio/opus': 'audio/ogg',
});

const EXTENSION_MIME = Object.freeze({
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
});

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DATA_URL_RE = /^data:audio\/(mpeg|ogg|webm|mp4|wav);base64,[A-Za-z0-9+/]+=*$/;

/** Приводит MIME (или расширение имени файла) к одному из AUDIO_MIME; иначе null. */
export function normalizeAudioMime(mime, fileName = '') {
  const m = String(mime ?? '')
    .toLowerCase()
    .split(';')[0]
    .trim();
  if (AUDIO_MIME.includes(m)) return m;
  if (MIME_ALIASES[m]) return MIME_ALIASES[m];
  const ext = String(fileName).toLowerCase().split('.').pop();
  return EXTENSION_MIME[ext] ?? null;
}

/**
 * Проверяет файл перед загрузкой. Возвращает { mime } или { error } с текстом
 * для автора.
 */
export function validateAudioFile({ type, size, name }) {
  const mime = normalizeAudioMime(type, name);
  if (!mime) return { error: 'Поддерживаются MP3, OGG, WebM, M4A и WAV.' };
  if (!(size > 0)) return { error: 'Файл пустой.' };
  if (size > AUDIO_LIMITS.FILE_MAX_BYTES) {
    return {
      error: `Файл больше ${Math.round(AUDIO_LIMITS.FILE_MAX_BYTES / 1024)} КБ. Сожмите запись (MP3 64 кбит/с — около 40 с) или дайте ссылку.`,
    };
  }
  return { mime };
}

/** Меняет MIME в data URL на нормализованный (браузер мог подставить audio/x-wav и т.п.). */
export function withAudioMime(dataUrl, mime) {
  const comma = String(dataUrl).indexOf(',');
  return comma < 0 ? '' : `data:${mime};base64,${String(dataUrl).slice(comma + 1)}`;
}

export function isValidAudioDataUrl(value) {
  return typeof value === 'string' && value.length <= AUDIO_LIMITS.DATA_URL_MAX && DATA_URL_RE.test(value);
}

/**
 * Проверяет внешнюю ссылку: https, разрешённый хост, без логина/порта,
 * путь заканчивается аудиорасширением. Возвращает { url } (нормализованную)
 * или { error }.
 */
export function validateAudioUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { error: 'Вставьте ссылку.' };
  if (raw.length > AUDIO_LIMITS.URL_MAX) return { error: 'Слишком длинная ссылка.' };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'Это не ссылка.' };
  }
  if (url.protocol !== 'https:') return { error: 'Нужна ссылка https://.' };
  if (url.username || url.password || url.port) return { error: 'Ссылка не должна содержать логин или порт.' };
  if (!AUDIO_HOSTS.includes(url.hostname)) {
    return {
      error: `Ссылки разрешены только на ${AUDIO_HOSTS.join(', ')} (прямая ссылка на файл Викисклада).`,
    };
  }
  const ext = decodeURIComponent(url.pathname).toLowerCase().split('.').pop();
  if (!EXTENSION_MIME[ext])
    return {
      error: 'Ссылка должна вести на файл .mp3, .ogg, .oga, .opus, .webm, .m4a или .wav.',
    };
  url.hash = '';
  return { url: url.toString() };
}

/** Очищает ссылку на аудио из контента; неверная — null. */
export function sanitizeAudioRef(ref) {
  if (!ref || typeof ref !== 'object') return null;
  if (ref.kind === 'file' && typeof ref.id === 'string' && ID_RE.test(ref.id)) return { kind: 'file', id: ref.id };
  if (ref.kind === 'url') {
    const { url } = validateAudioUrl(ref.url);
    return url ? { kind: 'url', url } : null;
  }
  return null;
}

/** id загруженных файлов, на которые ссылаются блоки и слова (для копирования при публикации). */
export function collectAudioIds(values) {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (value.kind === 'file' && typeof value.id === 'string' && ID_RE.test(value.id)) ids.add(value.id);
      Object.values(value).forEach(visit);
    }
  };
  visit(values);
  return ids;
}
