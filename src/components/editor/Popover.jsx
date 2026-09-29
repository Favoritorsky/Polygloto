import { useEffect, useRef, useState } from 'react';
import styles from './Popover.module.css';

/**
 * Выпадающая панель для тулбара. Кнопки внутри используют onMouseDown +
 * preventDefault, чтобы не терять выделение в редакторе.
 */
export default function Popover({ label, title, active = false, disabled = false, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={active ? `${styles.trigger} ${styles.active}` : styles.trigger}
        title={title}
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
      >
        {label} ▾
      </button>
      {open && (
        <div className={styles.panel} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
