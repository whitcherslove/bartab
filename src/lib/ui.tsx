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

  // Смахивание шторки вниз: тянем за полоску или за шторку, когда она пролистана до начала
  const sheetEl = useRef<HTMLDivElement | null>(null);
  const scrimEl = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number; active: boolean; fromGrab: boolean } | null>(null);

  const setOffset = (dy: number, animate: boolean) => {
    const el = sheetEl.current;
    if (!el) return;
    el.style.transition = animate ? 'transform .22s ease' : 'none';
    el.style.transform = dy ? `translateY(${dy}px)` : '';
    if (scrimEl.current) scrimEl.current.style.backgroundColor = dy ? `rgba(0,0,0,${Math.max(0, 0.45 * (1 - dy / 400))})` : '';
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const el = sheetEl.current;
    if (!el) return;
    const target = e.target as HTMLElement;
    const fromGrab = !!target.closest('.grab');
    // поля ввода и прокручиваемые списки внутри не перехватываем
    if (!fromGrab && (target.closest('input, textarea, select') || el.scrollTop > 0)) { drag.current = null; return; }
    drag.current = { y0: e.touches[0].clientY, t0: Date.now(), dy: 0, active: false, fromGrab };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current, el = sheetEl.current;
    if (!d || !el) return;
    const dy = e.touches[0].clientY - d.y0;
    if (!d.active) {
      if (dy < 6) { if (dy < -6) drag.current = null; return; } // вверх — обычная прокрутка
      if (!d.fromGrab && el.scrollTop > 0) { drag.current = null; return; }
      d.active = true;
    }
    d.dy = Math.max(0, dy);
    setOffset(d.dy, false);
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const fast = d.dy > 50 && d.dy / Math.max(1, Date.now() - d.t0) > 0.6;
    if (d.dy > 120 || fast) {
      setOffset(window.innerHeight, true);
      setTimeout(() => close(), 180);
    } else {
      setOffset(0, true);
    }
  };

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
        <div className="scrim" ref={scrimEl} onClick={(e) => e.target === e.currentTarget && close()}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            key={sheet.key}
            ref={sheetEl}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
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
