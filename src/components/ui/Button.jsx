import styles from './Button.module.css';

/**
 * Кнопка. variant: primary | secondary | ghost | danger. size: md | sm.
 * loading блокирует повторное нажатие (защита от двойной отправки формы).
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  const classes = [styles.button, styles[variant], styles[size], className].join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  );
}
