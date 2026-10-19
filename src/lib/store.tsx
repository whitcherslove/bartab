import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { BarEvent, State } from './types';
import { useAccount } from './account';
import { fetchCrew, pushDiff } from './remote';
import { humanError, supabase } from './supabase';
import { readCache, writeCache } from './cache';
import { clone } from './format';
import { Splash } from '../screens/auth/Splash';
import { ClaimStep } from '../screens/auth/ClaimStep';

// Данные компании живут в Supabase.
// Экраны меняют локальную копию через update(), а сюда же складываются
// изменения: через 300 мс они уходят в базу одним пакетом. Изменения от
// друзей прилетают через Realtime, и копия перезагружается.

type Store = {
  state: State;
  crewId: string;
  update: (fn: (draft: State) => void) => void;
  updateEvent: (id: string, fn: (ev: BarEvent) => void) => void;
  nameOf: (id: string) => string;
  refresh: () => Promise<void>;
  /** отправить всё накопленное в базу и дождаться */
  sync: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const DEBOUNCE_MS = 300;

export function StoreProvider({ children }: { children: ReactNode }) {
  const { crew, session } = useAccount();
  const crewId = crew.id;
  const userId = session.user.id;

  const cacheKey = `crew:${crewId}:${userId}`;
  const [state, setStateRaw] = useState<State | null>(() => readCache<State>(cacheKey));
  const [loadError, setLoadError] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const [syncError, setSyncError] = useState('');

  const stateRef = useRef<State | null>(state);
  const base = useRef<State | null>(null); // состояние до ещё не отправленных изменений
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const remoteDirty = useRef(false);

  const setState = useCallback((s: State | null) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const busy = () => base.current !== null || inFlight.current > 0;

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchCrew(crewId, userId);
      if (busy()) { remoteDirty.current = true; return; } // пока пишем — не затираем
      setState(fresh);
      writeCache(cacheKey, fresh);
      setLoadError('');
      setOffline(false);
    } catch (e) {
      if (stateRef.current) setOffline(true); // показываем сохранённое
      else setLoadError(humanError(e));
    }
  }, [crewId, userId, cacheKey, setState]);

  // Отправка накопленных изменений
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const prev = base.current;
    const next = stateRef.current;
    base.current = null;
    if (!prev || !next) return;
    inFlight.current++;
    queue.current = queue.current
      .then(() => pushDiff(prev, next, crewId))
      .then(() => setSyncError(''))
      .catch((e) => {
        setSyncError('Не удалось сохранить: ' + humanError(e));
        remoteDirty.current = true; // вернём то, что реально лежит в базе
      })
      .finally(() => {
        inFlight.current--;
        if (!busy() && remoteDirty.current) {
          remoteDirty.current = false;
          refresh();
        }
      });
  }, [crewId, refresh]);

  const update = useCallback((fn: (draft: State) => void) => {
    const prev = stateRef.current;
    if (!prev) return;
    const next = clone(prev);
    fn(next);
    if (!base.current) base.current = prev;
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush, setState]);

  const updateEvent = useCallback(
    (id: string, fn: (ev: BarEvent) => void) =>
      update((d) => {
        const ev = d.events.find((e) => e.id === id);
        if (ev) fn(ev);
      }),
    [update],
  );

  // Первая загрузка и смена компании: сразу показываем сохранённое, потом подтягиваем свежее
  useEffect(() => {
    setState(readCache<State>(cacheKey));
    base.current = null;
    refresh();
  }, [cacheKey, refresh, setState]);

  // Сеть пропала / появилась
  useEffect(() => {
    const on = () => { setOffline(false); refresh(); };
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh]);

  // Изменения от друзей в реальном времени
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onRemote = () => {
      if (busy()) { remoteDirty.current = true; return; }
      clearTimeout(t);
      t = setTimeout(refresh, 250);
    };
    const filter = `crew_id=eq.${crewId}`;
    const channel = supabase
      .channel(`crew-${crewId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'people', filter }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_members' }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, onRemote)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_shares' }, onRemote)
      .subscribe();
    return () => {
      clearTimeout(t);
      supabase.removeChannel(channel);
    };
  }, [crewId, refresh]);

  // Свернули приложение — сразу отправляем, что накопилось; вернулись — подтягиваем свежее
  useEffect(() => {
    const onVis = () => (document.visibilityState === 'hidden' ? flush() : refresh());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [flush, refresh]);

  const sync = useCallback(async () => {
    flush();
    await queue.current;
  }, [flush]);

  const nameOf = useCallback((id: string) => stateRef.current?.people.find((p) => p.id === id)?.name ?? '?', []);

  if (!state) return <Splash message={loadError} onRetry={loadError ? refresh : undefined} />;
  if (!state.me) return <ClaimStep people={state.people} crewId={crewId} onDone={refresh} />;

  return (
    <Ctx.Provider value={{ state, crewId, update, updateEvent, nameOf, refresh, sync }}>
      {children}
      {offline && !syncError && <div className="offline-bar" role="status">Нет сети — показаны последние данные</div>}
      {syncError && (
        <div className="sync-err" role="alert">
          {syncError}
          <button onClick={() => setSyncError('')} aria-label="Закрыть">×</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore вне StoreProvider');
  return c;
}
