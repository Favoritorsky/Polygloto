/** Тема оформления: 'dark' (по умолчанию) или 'light'. См. public/theme-init.js. */
export const THEME_STORAGE_KEY = 'polygloto-theme';
export const DEFAULT_THEME = 'dark';

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : DEFAULT_THEME;
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Без localStorage тема действует до перезагрузки страницы.
  }
}
