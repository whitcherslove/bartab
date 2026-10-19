import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type View = { screen: 'events' | 'places' | 'crew' | 'profile' } | { screen: 'event'; id: string };

type UI = {
  view: View;
  go: (v: View) => void;
  open: (node: ReactNode) => void;
  close: () => void;
  toast: (text: string) => void;
};

const Ctx = createContext<UI | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ screen: 'events' });
  const [sheet, setSheet] = useState<{ node: ReactNode; key: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number } | null>(null);
  const counter = useRef(0);

  const go = useCallback((v: View) => {
    setSheet(null);
    setView(v);
    window.scrollTo(0, 0);
  }, []);
  const open = useCallback((node: ReactNode) => setSheet({ node, key: ++counter.current }), []);
  const close = useCallback(() => setSheet(null), []);
  const toast = useCallback((text: string) => setToastMsg({ text, key: ++counter.current }), []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet]);

  return (
    <Ctx.Provider value={{ view, go, open, close, toast }}>
      {children}
      {sheet && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="sheet" role="dialog" aria-modal="true" key={sheet.key}>
            <div className="grab" />
            {sheet.node}
          </div>
        </div>
      )}
      {toastMsg && (
        <div className="toast" role="status" key={toastMsg.key}>
          {toastMsg.text}
        </div>
      )}
    </Ctx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI вне UIProvider');
  return c;
}
