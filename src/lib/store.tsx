import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { BarEvent, State } from './types';
import { seed } from './seed';

// Пока данные живут в браузере. На этапе 4 здесь появится Supabase,
// а экраны менять не придётся: они работают только через useStore().

const KEY = 'bartab-v1';

type Store = {
  state: State;
  update: (fn: (draft: State) => void) => void;
  updateEvent: (id: string, fn: (ev: BarEvent) => void) => void;
  reset: () => void;
  nameOf: (id: string) => string;
};

const Ctx = createContext<Store | null>(null);

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* хранилище недоступно — начинаем с демо */
  }
  return seed();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* не удалось сохранить — работаем в памяти */
    }
  }, [state]);

  const update = useCallback((fn: (draft: State) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  const updateEvent = useCallback(
    (id: string, fn: (ev: BarEvent) => void) =>
      update((d) => {
        const ev = d.events.find((e) => e.id === id);
        if (ev) fn(ev);
      }),
    [update],
  );

  const reset = useCallback(() => setState(seed()), []);
  const nameOf = useCallback((id: string) => state.people.find((p) => p.id === id)?.name ?? '?', [state.people]);

  return <Ctx.Provider value={{ state, update, updateEvent, reset, nameOf }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore вне StoreProvider');
  return c;
}
