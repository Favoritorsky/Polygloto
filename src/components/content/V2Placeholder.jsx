import styles from './V2Placeholder.module.css';

/** Заглушка для зарезервированных блоков v2 (аудио, подстрочный разбор). */
export default function V2Placeholder({ block }) {
  return <div className={styles.placeholder}>Блок «{block.type}» появится в следующей версии.</div>;
}
