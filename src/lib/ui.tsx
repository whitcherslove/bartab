import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type View = { screen: 'events' | 'places' | 'crew' | 'profile' } | { screen: 'event'; id: string };

type UI = {
  view: View;
  go: (v: View) => void;
  /** «Назад» внутри приложения: как системная кнопка */
  back: () => void;
  /** закрыть шторку и сразу вернуться на экран назад (например, после удаления посиделки) */
  closeAndBack: () => void;
  open: (node: ReactNode) => void;
  close: () => void;
  toast: (text: string) => void;
};

const Ctx = createContext<UI | null>(null);

// Каждый экран и каждая открытая шторка — запись в истории браузера.
// Поэтому системная кнопка «Назад» (Android, жест в браузере) закрывает
// шторку или возвращает на предыдущий экран, а не выходит из приложения.
type HistState = { bartab: true; view: View; depth: number; sheet?: boolean };

const ROOT: View = { screen: 'events' };
const sameView = (a: View, b: View) => a.screen === b.screen && (a.screen !== 'event' || (b.screen === 'event' && a.id === b.id));

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(ROOT);
  const [sheet, setSheet] = useState<{ node: ReactNode; key: number } | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; key: number } | null>(null);
  const counter = useRef(0);
  const viewRef = useRef<View>(ROOT);
  const depthRef = useRef(0);
  const sheetOpen = useRef(false);
  const ignorePop = useRef(0); // сколько ближайших «назад» сделали мы сами

  const showView = useCallback((v: View) => {
    viewRef.current = v;
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  // Стартовая запись истории
  useEffect(() => {
    const st: HistState = { bartab: true, view: ROOT, depth: 0 };
    window.history.replaceState(st, '');
  }, []);

  // Системная кнопка «Назад»
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (ignorePop.current > 0) { ignorePop.current--; return; }
      const st = e.state as HistState | null;
      if (sheetOpen.current) {
        // закрываем шторку, экран остаётся прежним
        sheetOpen.current = false;
        setSheet(null);
        if (st?.bartab && !st.sheet) depthRef.current = st.depth;
        return;
      }
      const v = st?.bartab ? st.view : ROOT;
      depthRef.current = st?.bartab ? st.depth : 0;
      showView(v);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showView]);

  const go = useCallback((v: View) => {
    if (sheetOpen.current) {
      // переход прямо из шторки: подменяем запись шторки на новый экран
      sheetOpen.current = false;
      setSheet(null);
      if (sameView(v, viewRef.current)) {
        ignorePop.current++;
        window.history.back();
        return;
      }
      const st: HistState = { bartab: true, view: v, depth: depthRef.current + 1 };
      depthRef.current = st.depth;
      window.history.replaceState(st, '');
      showView(v);
      return;
    }
    if (sameView(v, viewRef.current)) return;
    const st: HistState = { bartab: true, view: v, depth: depthRef.current + 1 };
    depthRef.current = st.depth;
    window.history.pushState(st, '');
    showView(v);
  }, [showView]);

  const back = useCallback(() => {
    if (depthRef.current > 0 || sheetOpen.current) window.history.back();
    else showView(ROOT);
  }, [showView]);

  const closeAndBack = useCallback(() => {
    const hadSheet = sheetOpen.current;
    sheetOpen.current = false;
    setSheet(null);
    const steps = (hadSheet ? 1 : 0) + (depthRef.current > 0 ? 1 : 0);
    if (steps === 0) return showView(ROOT);
    if (depthRef.current === 0) { ignorePop.current++; window.history.back(); showView(ROOT); return; }
    window.history.go(-steps); // одно перемещение — обработчик «Назад» покажет нужный экран
  }, [showView]);

  const open = useCallback((node: ReactNode) => {
    if (!sheetOpen.current) {
      const st: HistState = { bartab: true, view: viewRef.current, depth: depthRef.current, sheet: true };
      window.history.pushState(st, '');
      sheetOpen.current = true;
    }
    // шторка из шторки — заменяем содержимое, «Назад» закроет её целиком
    setSheet({ node, key: ++counter.current });
  }, []);

  const close = useCallback(() => {
    if (!sheetOpen.current) return;
    sheetOpen.current = false;
    setSheet(null);
    ignorePop.current++;
    window.history.back();
  }, []);

  const toast = useCallback((text: string) => setToastMsg({ text, key: ++counter.current }), []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, close]);

  return (
    <Ctx.Provider value={{ view, go, back, closeAndBack, open, close, toast }}>
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
