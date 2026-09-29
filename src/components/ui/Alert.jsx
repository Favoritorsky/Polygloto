import styles from './Alert.module.css';

/** Сообщение. tone: error | success | warning | info. */
export default function Alert({ tone = 'info', title, children, action }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
