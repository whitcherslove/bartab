// Тема: системная, светлая или тёмная. Хранится на устройстве.

export type Theme = 'system' | 'light' | 'dark';
const KEY = 'bartab-theme';

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(t: Theme = getTheme()) {
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121917' : '#F1F4F1');
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
}

// системная тема могла смениться, пока приложение открыто
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
