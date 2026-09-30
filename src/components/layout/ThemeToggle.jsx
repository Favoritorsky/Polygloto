import { useState } from 'react';
import { getTheme, setTheme } from '../../theme/theme.js';
import styles from './ThemeToggle.module.css';

/** Переключатель тёмной и светлой темы в шапке. */
export default function ThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Включить светлую тему' : 'Включить тёмную тему';

  function toggle() {
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button type="button" className={styles.toggle} onClick={toggle} aria-label={label} title={label}>
      <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
    </button>
  );
}
