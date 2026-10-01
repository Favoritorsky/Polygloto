import { useState } from 'react';
import { toUserMessage } from '../services/errors.js';
import { useAudioSource } from './audioSourceContext.js';
import styles from './AudioPlayer.module.css';

/**
 * Плеер для ссылки на аудио ({ kind: 'file', id } | { kind: 'url', url }).
 * Файл не грузится, пока его не включат: data URL может весить сотни килобайт.
 */
export default function AudioPlayer({ audio, label = 'Слушать', text = label, compact = false }) {
  const { load } = useAudioSource();
  const [state, setState] = useState({
    status: 'idle',
    src: null,
    error: null,
  });

  if (!audio) return null;

  async function start() {
    if (audio.kind === 'url') {
      setState({ status: 'ready', src: audio.url, error: null });
      return;
    }
    setState({ status: 'loading', src: null, error: null });
    try {
      setState({ status: 'ready', src: await load(audio.id), error: null });
    } catch (error) {
      setState({ status: 'error', src: null, error: toUserMessage(error) });
    }
  }

  if (state.status === 'ready') {
    return (
      <audio
        className={compact ? styles.audioCompact : styles.audio}
        src={state.src}
        controls
        autoPlay
        preload="auto"
        aria-label={label}
        onError={() =>
          setState({
            status: 'error',
            src: null,
            error: 'Не удалось воспроизвести запись.',
          })
        }
      />
    );
  }
  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={compact ? styles.playCompact : styles.play}
        onClick={start}
        disabled={state.status === 'loading'}
        aria-label={label}
      >
        <span aria-hidden="true">{state.status === 'loading' ? '…' : '▶'}</span>
        {!compact && <span>{state.status === 'loading' ? 'Загрузка…' : text}</span>}
      </button>
      {state.error && (
        <span className={styles.error} role="alert">
          {state.error}
        </span>
      )}
    </span>
  );
}
