/**
 * Inline script body executed before paint to avoid theme flash.
 * Mirrors the resolution logic in lib/theme.ts.
 *
 * Loaded via <Script strategy="beforeInteractive"> in app/layout.tsx so it
 * runs synchronously during initial HTML parse, before React hydrates.
 */
export const THEME_INIT_CODE = `(() => {
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
  } catch (e) {}
})();`;
