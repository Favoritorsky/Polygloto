import { useId, useRef, useState } from 'react';
import { AUDIO_HOSTS, AUDIO_LIMITS, sanitizeAudioRef, validateAudioUrl } from '../../shared/audio.js';
import { toUserMessage } from '../services/errors.js';
import AudioPlayer from './AudioPlayer.jsx';
import { useAudioSource } from './audioSourceContext.js';
import styles from './AudioRefEditor.module.css';

/**
 * Выбор аудио автором: загрузить файл (хранится в курсе) или дать ссылку
 * на разрешённый хост. value/onChange — ссылка на аудио (AudioRef) или null.
 */
export default function AudioRefEditor({ value, onChange, readOnly, label = 'Аудио' }) {
  const { upload } = useAudioSource();
  const audio = sanitizeAudioRef(value);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const id = useId();

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !upload) return;
    setError(null);
    setBusy(true);
    try {
      onChange({ kind: 'file', id: await upload(file) });
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function handleUrl() {
    const result = validateAudioUrl(url);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setUrl('');
    onChange({ kind: 'url', url: result.url });
  }

  return (
    <div className={styles.box} role="group" aria-label={label}>
      <span className={styles.label}>{label}</span>
      {audio ? (
        <div className={styles.row}>
          <AudioPlayer key={audio.kind === 'file' ? audio.id : audio.url} audio={audio} label="Прослушать" />
          <span className={styles.meta}>{audio.kind === 'file' ? 'файл курса' : new URL(audio.url).hostname}</span>
          {!readOnly && (
            <button type="button" className={styles.small} onClick={() => onChange(null)}>
              Убрать аудио
            </button>
          )}
        </div>
      ) : readOnly ? (
        <span className={styles.meta}>Нет аудио.</span>
      ) : (
        <>
          {upload && (
            <div className={styles.row}>
              <button type="button" className={styles.small} onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? 'Загрузка…' : 'Загрузить файл'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.ogg,.oga,.opus,.webm,.m4a,.wav"
                hidden
                onChange={handleFile}
                aria-label="Аудиофайл"
              />
              <span className={styles.meta}>MP3, OGG, WebM, M4A, WAV, до {Math.round(AUDIO_LIMITS.FILE_MAX_BYTES / 1024)} КБ</span>
            </div>
          )}
          <div className={styles.row}>
            <input
              id={`${id}-url`}
              className={styles.url}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrl();
                }
              }}
              placeholder={`https://${AUDIO_HOSTS[0]}/…/file.ogg`}
              aria-label="Ссылка на аудио"
              maxLength={AUDIO_LIMITS.URL_MAX}
            />
            <button type="button" className={styles.small} onClick={handleUrl}>
              Добавить ссылку
            </button>
          </div>
        </>
      )}
      {error && (
        <span className={styles.error} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
