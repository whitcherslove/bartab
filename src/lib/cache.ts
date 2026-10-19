// Последние загруженные данные храним на телефоне,
// чтобы приложение открывалось даже без связи.

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem('bartab-cache:' + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem('bartab-cache:' + key, JSON.stringify(value));
  } catch {
    /* места нет — не страшно */
  }
}

export function clearCache() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('bartab-cache:')).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
