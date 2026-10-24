// «Сразу из запомненного, свежее — в фоне»: экраны не ждут сети при каждом открытии.
// Значения живут в памяти и в localStorage (переживают перезапуск приложения).
import { useEffect, useState } from 'react';

const PREFIX = 'bartab-cache:';
const mem = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** Запомненное значение (или undefined) */
export function peek<T>(key: string): T | undefined {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) { const v = JSON.parse(raw) as T; mem.set(key, v); return v; }
  } catch { /* ignore */ }
  return undefined;
}

export function put<T>(key: string, v: T) {
  mem.set(key, v);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(v)); } catch { /* места нет — живём в памяти */ }
}

/** Загрузить свежее и запомнить; одновременные запросы одного ключа — один поход в сеть */
export function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cur = inflight.get(key);
  if (cur) return cur as Promise<T>;
  const p = fetcher()
    .then((v) => { put(key, v); return v; })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Вышел из аккаунта — забываем всё */
export function clearCached() {
  mem.clear();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/** Хук: сразу запомненное, потом свежее. error — только если запомненного нет и загрузка упала */
export function useCached<T>(key: string, fetcher: () => Promise<T>): { data: T | undefined; error: boolean } {
  const [st, setSt] = useState<{ key: string; data: T | undefined; error: boolean }>(() => ({ key, data: peek<T>(key), error: false }));
  useEffect(() => {
    let alive = true;
    load(key, fetcher)
      .then((v) => { if (alive) setSt({ key, data: v, error: false }); })
      .catch(() => { if (alive) setSt((s) => ({ key, data: s.key === key ? s.data : peek<T>(key), error: true })); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = st.key === key ? st.data : peek<T>(key);
  return { data, error: st.key === key && st.error && data === undefined };
}
