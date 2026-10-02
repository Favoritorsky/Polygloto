import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

/** Модальное окно на нативном <dialog> (фокус и Esc — средствами браузера). */
export default function Modal({ open, title, onClose, size = 'md', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={size === 'wide' ? `${styles.dialog} ${styles.wide}` : styles.dialog} onClose={onClose} aria-label={title}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      {open && children}
    </dialog>
  );
}
