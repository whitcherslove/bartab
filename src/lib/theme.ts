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

// ---------- Цвет приложения (акцент) ----------

export const ACCENTS = [
  { id: 'amber', name: 'Янтарь', light: '#B8650C', dark: '#F2A340' },
  { id: 'hop', name: 'Хмель', light: '#2F7D5B', dark: '#5FC79A' },
  { id: 'cherry', name: 'Вишня', light: '#B4234E', dark: '#F0718F' },
  { id: 'lavender', name: 'Лаванда', light: '#6B4BC4', dark: '#A98DF5' },
  { id: 'ocean', name: 'Океан', light: '#1F6FB2', dark: '#6BB2F0' },
  { id: 'mint', name: 'Мята', light: '#0F8080', dark: '#4FD1C5' },
  { id: 'coral', name: 'Коралл', light: '#C94E33', dark: '#FF8A6B' },
  { id: 'graphite', name: 'Графит', light: '#3A4A45', dark: '#C9D3CF' },
] as const;
export type Accent = (typeof ACCENTS)[number]['id'];
const ACCENT_KEY = 'bartab-accent';

export function getAccent(): Accent {
  try {
    const a = localStorage.getItem(ACCENT_KEY);
    return (ACCENTS.find((x) => x.id === a)?.id ?? 'amber') as Accent;
  } catch {
    return 'amber';
  }
}

export function applyAccent(a: Accent = getAccent()) {
  const root = document.documentElement;
  if (a === 'amber') root.removeAttribute('data-accent');
  else root.setAttribute('data-accent', a);
}

export function setAccent(a: Accent) {
  try { localStorage.setItem(ACCENT_KEY, a); } catch { /* ignore */ }
  applyAccent(a);
}

// системная тема могла смениться, пока приложение открыто
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
