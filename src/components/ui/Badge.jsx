import styles from './Badge.module.css';

/** Небольшая метка. tone: neutral | positive | negative | attention. */
export default function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {children}
    </span>
  );
}
