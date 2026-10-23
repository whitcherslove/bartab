import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { getHome } from './tabs';

export type View = { screen: 'events' | 'places' | 'crew' | 'profile' | 'admin' } | { screen: 'event'; id: string };

type UI = {
  view: View;
  go: (v: View) => void;
  /** «Назад» внутри приложения: как системная кнопка */
  back: () => void;
  /** закрыть шторку и сразу вернуться на экран назад (например, после удаления встречи) */
  closeAndBack: () => void;
  /** full — на весь экран (просмотр фото), без шторки */
  open: (node: ReactNode, opts?: { full?: boolean }) => void;
  close: () => void;
  /** короткое сообщение сверху; action — кнопка, например «Вернуть» */
  toast: (text: string, opts?: ToastOpts) => void;
  /** ошибка: красная, держится дольше, закрывается тапом */
  fail: (text: string) => void;
  /** открыта ли сейчас шторка */
  hasSheet: boolean;
};

export type ToastOpts = { action?: { label: string; run: () => void } };
type ToastMsg = { text: string; key: number; error?: boolean; action?: ToastOpts['action'] };

const Ctx = createContext<UI | null>(null);

// Каждый экран и каждая открытая шторка — запись в истории браузера.
// Поэтому системная кнопка «Назад» (Android, жест в браузере) закрывает
// шторку или возвращает на предыдущий экран, а не выходит из приложения.
type HistState = { bartab: true; view: View; depth: number; sheet?: boolean };

/** Главный экран — из настроек (вкладка, выбранная звёздочкой) */
const rootView = (): View => ({ screen: getHome() });

// При смене компании данные грузятся заново и экраны пересоздаются.
// Запоминаем текущий экран, чтобы не выкидывало на главный (например, после создания компании).
let keptView: View | null = null;
// куда открыть приложение в следующий раз (вступил в компанию — на экран компании)
// (живёт 5 минут — хватает на «Кто ты в списке?», но не всплывёт внезапно потом)
let pendingView: { v: View; until: number } | null = null;
const pending = () => (pendingView && Date.now() < pendingView.until ? pendingView.v : null);
const startView = (): View => pending() ?? keptView ?? rootView();
/** Следующий запуск экранов начнётся с этого экрана (важнее запомненного) */
// eslint-disable-next-line react-refresh/only-export-components
export function startOn(v: View) { pendingView = { v, until: Date.now() + 5 * 60_000 }; }
/** Выход из аккаунта: после входа начинаем с главного экрана */
// eslint-disable-next-line react-refresh/only-export-components
export function forgetView() { keptView = null; }
const sameView = (a: View, b: View) => a.screen === b.screen && (a.screen !== 'event' || (b.screen === 'event' && a.id === b.id));

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(startView);
  const [sheet, setSheet] = useState<{ node: ReactNode; key: number; full?: boolean } | null>(null);
  const [toastMsg, setToastMsg] = useState<ToastMsg | null>(null);
  const counter = useRef(0);
  const viewRef = useRef<View>(view);
  const depthRef = useRef(0);
  const sheetOpen = useRef(false);
  const swiped = useRef(false); // шторку уже смахнули пальцем — повторно не анимируем
  const ignorePop = useRef(0); // сколько ближайших «назад» сделали мы сами

  /** Показать экран; dir — направление анимации (въезд встречи справа, «назад» — вправо) */
  /** Убрать шторку с анимацией «уезжает вниз» (копия DOM, чтобы не трогать React) */
  const dropSheet = useCallback(() => {
    const el = document.querySelector('.scrim:not(.leaving), .viewer:not(.leaving)') as HTMLElement | null;
    if (el && !swiped.current && !reducedMotion()) {
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('leaving');
      ghost.setAttribute('aria-hidden', 'true');
      document.body.appendChild(ghost);
      setTimeout(() => ghost.remove(), 240);
    }
    swiped.current = false;
    setSheet(null);
  }, []);

  const showView = useCallback((v: View, dir: 'forward' | 'back' | 'fade' = 'fade') => {
    viewRef.current = v;
    const apply = () => { setView(v); window.scrollTo(0, 0); };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !reducedMotion()) {
      document.documentElement.dataset.nav = dir;
      doc.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  }, []);

  // Стартовая запись истории
  useEffect(() => {
    const st: HistState = { bartab: true, view: viewRef.current, depth: 0 };
    window.history.replaceState(st, '');
    keptView = null;
    pendingView = null;
    // экраны пересоздаются (смена компании) — запоминаем, где были
    return () => { keptView = viewRef.current; };
  }, []);

  // Системная кнопка «Назад»
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      if (ignorePop.current > 0) { ignorePop.current--; return; }
      const st = e.state as HistState | null;
      if (sheetOpen.current) {
        // закрываем шторку, экран остаётся прежним
        sheetOpen.current = false;
        dropSheet();
        if (st?.bartab && !st.sheet) depthRef.current = st.depth;
        return;
      }
      const v = st?.bartab ? st.view : rootView();
      depthRef.current = st?.bartab ? st.depth : 0;
      const from = viewRef.current.screen;
      showView(v, (from === 'event' || from === 'admin') && v.screen !== 'event' ? 'back' : 'fade');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [showView, dropSheet]);

  const go = useCallback((v: View) => {
    if (sheetOpen.current) {
      // переход прямо из шторки: подменяем запись шторки на новый экран
      sheetOpen.current = false;
      dropSheet();
      if (sameView(v, viewRef.current)) {
        ignorePop.current++;
        window.history.back();
        return;
      }
      const st: HistState = { bartab: true, view: v, depth: depthRef.current + 1 };
      depthRef.current = st.depth;
      window.history.replaceState(st, '');
      showView(v, v.screen === 'event' ? 'forward' : 'fade');
      return;
    }
    if (sameView(v, viewRef.current)) return;
    const st: HistState = { bartab: true, view: v, depth: depthRef.current + 1 };
    depthRef.current = st.depth;
    window.history.pushState(st, '');
    showView(v, v.screen === 'event' || v.screen === 'admin' ? 'forward' : 'fade');
  }, [showView, dropSheet]);

  const back = useCallback(() => {
    if (depthRef.current > 0 || sheetOpen.current) window.history.back();
    else showView(rootView(), 'back');
  }, [showView]);

  const closeAndBack = useCallback(() => {
    const hadSheet = sheetOpen.current;
    sheetOpen.current = false;
    setSheet(null);
    const steps = (hadSheet ? 1 : 0) + (depthRef.current > 0 ? 1 : 0);
    if (steps === 0) return showView(rootView());
    if (depthRef.current === 0) { ignorePop.current++; window.history.back(); showView(rootView()); return; }
    window.history.go(-steps); // одно перемещение — обработчик «Назад» покажет нужный экран
  }, [showView]);

  const open = useCallback((node: ReactNode, opts?: { full?: boolean }) => {
    if (!sheetOpen.current) {
      const st: HistState = { bartab: true, view: viewRef.current, depth: depthRef.current, sheet: true };
      window.history.pushState(st, '');
      sheetOpen.current = true;
    }
    // шторка из шторки — заменяем содержимое, «Назад» закроет её целиком
    setSheet({ node, key: ++counter.current, full: opts?.full });
  }, []);

  const close = useCallback(() => {
    if (!sheetOpen.current) return;
    sheetOpen.current = false;
    dropSheet();
    ignorePop.current++;
    window.history.back();
  }, [dropSheet]);

  const toast = useCallback((text: string, opts?: ToastOpts) => setToastMsg({ text, key: ++counter.current, action: opts?.action }), []);
  const fail = useCallback((text: string) => setToastMsg({ text, key: ++counter.current, error: true }), []);

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
      swiped.current = true;
      setTimeout(() => close(), 180);
    } else {
      setOffset(0, true);
    }
  };

  useEffect(() => {
    if (!toastMsg) return;
    // обычное — 2,2 с; с «Вернуть» и ошибки — дольше, чтобы успеть прочитать и нажать
    const t = setTimeout(() => setToastMsg(null), toastMsg.error || toastMsg.action ? 5000 : 2200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, close]);

  return (
    <Ctx.Provider value={{ view, go, back, closeAndBack, open, close, toast, fail, hasSheet: !!sheet }}>
      {children}
      {sheet?.full && (
        <div className="viewer" role="dialog" aria-modal="true" key={sheet.key}>
          {sheet.node}
        </div>
      )}
      {sheet && !sheet.full && (
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
      {toastMsg && <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />}
    </Ctx.Provider>
  );
}

/** Пилюля сверху: тап или смахивание вверх — убрать */
function Toast({ msg, onClose }: { msg: ToastMsg; onClose: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const d = useRef<{ y0: number; dy: number } | null>(null);
  const move = (dy: number, animate: boolean) => {
    if (!el.current) return;
    el.current.style.transition = animate ? 'transform .18s ease, opacity .18s ease' : 'none';
    el.current.style.transform = dy ? `translate(-50%, ${dy}px)` : '';
    el.current.style.opacity = dy ? String(Math.max(0, 1 + dy / 60)) : '';
  };
  return (
    <div
      className={'toast' + (msg.error ? ' error' : '') + (msg.action ? ' has-action' : '')}
      role={msg.error ? 'alert' : 'status'}
      key={msg.key}
      ref={el}
      onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button')) d.current = { y0: e.clientY, dy: 0 }; }}
      onPointerMove={(e) => { if (d.current) { d.current.dy = Math.min(0, e.clientY - d.current.y0); move(d.current.dy, false); } }}
      onPointerUp={() => {
        const s = d.current;
        d.current = null;
        if (!s) return;
        if (s.dy < -20 || Math.abs(s.dy) < 4) { move(-80, true); setTimeout(onClose, 160); } // смахнули вверх или тапнули
        else move(0, true);
      }}
      onPointerCancel={() => { d.current = null; move(0, true); }}
    >
      <span className="toast-text">{msg.text}</span>
      {msg.action && (
        <button className="toast-act" onClick={() => { msg.action!.run(); onClose(); }}>{msg.action.label}</button>
      )}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI вне UIProvider');
  return c;
}

/** То же, что useUI, но без ошибки вне провайдера (например, на экране входа) */
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalUI() {
  return useContext(Ctx);
}

/** Пользователь просил меньше движения — анимации выключаем */
// eslint-disable-next-line react-refresh/only-export-components
export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
