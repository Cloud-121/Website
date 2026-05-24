(() => {
  try {
    var k = 'gcm-theme';
    var stored = localStorage.getItem(k);
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (prefersLight ? 'light' : 'dark');
    var root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  } catch {}
})();
