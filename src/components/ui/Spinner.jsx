import styles from './Spinner.module.css';

export default function Spinner({ label = 'Загрузка…' }) {
  return (
    <div className={styles.wrap} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
