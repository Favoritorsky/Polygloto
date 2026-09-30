// Тема до первой отрисовки (без мигания светлой темы). По умолчанию — тёмная;
// выбор пользователя хранится в localStorage (src/theme/theme.js).
(function () {
  var theme = 'dark';
  try {
    var saved = localStorage.getItem('polygloto-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (e) {
    // localStorage может быть недоступен (приватный режим) — остаётся тёмная.
  }
  document.documentElement.dataset.theme = theme;
})();
