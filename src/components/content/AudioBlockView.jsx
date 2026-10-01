import AudioPlayer from '../../audio/AudioPlayer.jsx';
import styles from './AudioBlockView.module.css';

/** Аудиовставка в тексте урока (v2): плеер и подпись. Без записи блок не показывается. */
export default function AudioBlockView({ block }) {
  if (!block.audio) return null;
  return (
    <figure className={styles.block}>
      <AudioPlayer audio={block.audio} label={block.caption ? `Слушать: ${block.caption}` : 'Слушать'} text="Слушать" />
      {block.caption && <figcaption className={styles.caption}>{block.caption}</figcaption>}
    </figure>
  );
}
