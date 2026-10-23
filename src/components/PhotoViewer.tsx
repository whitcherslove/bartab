import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useUI } from '../lib/ui';
import { Icon } from './Icons';

export type ViewerPhoto = {
  key: string;
  /** '' — ещё загружается */
  url: string;
  title: string;
  caption?: ReactNode;
  /** цвет подписи: warn / error / busy */
  tone?: string;
};

type Pt = { x: number; y: number };
const MAX = 5;

/**
 * Полноэкранный просмотр фото: чеки, билеты, QR для входа.
 * Свайп влево/вправо — соседнее фото, вниз — закрыть.
 * Увеличение — двумя пальцами или двойным тапом (на всех остальных экранах зум выключен).
 */
export function PhotoViewer({ photos, start = 0, footer, overlay, onIndex }: {
  photos: ViewerPhoto[];
  start?: number;
  /** кнопки снизу для текущего фото */
  footer?: (i: number) => ReactNode;
  /** панель поверх фото (например, вопрос при удалении) */
  overlay?: ReactNode;
  onIndex?: (i: number) => void;
}) {
  const ui = useUI();
  const [index, setIndex] = useState(Math.min(start, Math.max(0, photos.length - 1)));
  const i = Math.min(index, Math.max(0, photos.length - 1)); // фото могли удалить
  const n = photos.length;

  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const z = useRef({ s: 1, x: 0, y: 0 }); // зум и сдвиг текущего фото
  const pointers = useRef(new Map<number, Pt>());
  const g = useRef<{ mode: '' | 'pan' | 'swipe' | 'pinch' | 'down'; p0: Pt; z0: { s: number; x: number; y: number }; d0: number; c: Pt; dx: number; dy: number; t0: number }>({ mode: '', p0: { x: 0, y: 0 }, z0: { s: 1, x: 0, y: 0 }, d0: 0, c: { x: 0, y: 0 }, dx: 0, dy: 0, t0: 0 });
  const lastTap = useRef<{ t: number; p: Pt }>({ t: 0, p: { x: 0, y: 0 } });

  useEffect(() => { onIndex?.(i); }, [i, onIndex]);

  const size = () => {
    const r = stage.current?.getBoundingClientRect();
    return { w: r?.width ?? window.innerWidth, h: r?.height ?? window.innerHeight, l: r?.left ?? 0, t: r?.top ?? 0 };
  };
  /** точка относительно центра экрана просмотра */
  const rel = (p: Pt): Pt => { const s = size(); return { x: p.x - s.l - s.w / 2, y: p.y - s.t - s.h / 2 }; };
  /** размер фото на экране без зума (вписано целиком) */
  const imgBox = () => {
    const { w, h } = size();
    const el = img.current;
    if (!el || !el.naturalWidth || !el.naturalHeight) return { w, h, dw: w, dh: h };
    const k = Math.min(w / el.naturalWidth, h / el.naturalHeight);
    return { w, h, dw: el.naturalWidth * k, dh: el.naturalHeight * k };
  };
  /** зум не меньше 1, фото не уезжает за края */
  const clamp = (v: { s: number; x: number; y: number }) => {
    const { w, h, dw, dh } = imgBox();
    const s = Math.min(MAX, Math.max(1, v.s));
    const mx = Math.max(0, (dw * s - w) / 2), my = Math.max(0, (dh * s - h) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  };

  const paintImg = (animate: boolean) => {
    const el = img.current;
    if (!el) return;
    const { s, x, y } = z.current;
    el.style.transition = animate ? 'transform .22s ease' : 'none';
    el.style.transform = s === 1 && !x && !y ? '' : `translate(${x}px, ${y}px) scale(${s})`;
  };
  const paintTrack = (dx: number, dy: number, animate: boolean) => {
    const el = track.current;
    if (!el) return;
    el.style.transition = animate ? 'transform .26s cubic-bezier(.2, .9, .3, 1)' : 'none';
    el.style.transform = `translate3d(calc(${-i * 100}% + ${dx}px), ${dy}px, 0)`;
    const bg = stage.current?.parentElement;
    if (bg) bg.style.backgroundColor = dy > 0 ? `rgba(0,0,0,${Math.max(0.3, 1 - dy / 500)})` : '';
  };

  // новое фото — без зума; при открытии встаём на нужное фото без анимации
  const mounted = useRef(false);
  useLayoutEffect(() => {
    z.current = { s: 1, x: 0, y: 0 };
    track.current?.querySelectorAll('img').forEach((el) => { el.style.transform = ''; });
    paintTrack(0, 0, mounted.current);
    mounted.current = true;
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (j: number) => {
    if (j < 0 || j >= n) { paintTrack(0, 0, true); return; }
    setIndex(j);
  };

  // стрелки на компьютере
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(i + 1);
      if (e.key === 'ArrowLeft') goTo(i - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const st = g.current;
    st.z0 = { ...z.current };
    if (pts.length === 2) {
      st.mode = 'pinch';
      st.d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const m = rel({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
      st.c = { x: (m.x - st.z0.x) / st.z0.s, y: (m.y - st.z0.y) / st.z0.s }; // точка фото под пальцами
      paintTrack(0, 0, true);
    } else if (pts.length === 1) {
      st.mode = '';
      st.p0 = pts[0];
      st.dx = st.dy = 0;
      st.t0 = Date.now();
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const st = g.current;
    if (st.mode === 'pinch' && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const m = rel({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
      const s = Math.min(MAX * 1.2, Math.max(0.8, (st.z0.s * d) / st.d0));
      z.current = { s, x: m.x - st.c.x * s, y: m.y - st.c.y * s };
      paintImg(false);
      return;
    }
    if (pts.length !== 1) return;
    const dx = pts[0].x - st.p0.x, dy = pts[0].y - st.p0.y;
    if (!st.mode) {
      if (Math.hypot(dx, dy) < 8) return;
      st.mode = z.current.s > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'swipe' : dy > 0 ? 'down' : 'pan';
    }
    if (st.mode === 'pan') {
      z.current = clamp({ s: z.current.s, x: st.z0.x + dx, y: st.z0.y + dy });
      paintImg(false);
    } else if (st.mode === 'swipe') {
      const edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0);
      st.dx = edge ? dx / 3 : dx; // у края — с сопротивлением
      paintTrack(st.dx, 0, false);
    } else if (st.mode === 'down') {
      st.dy = Math.max(0, dy);
      paintTrack(0, st.dy, false);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const st = g.current;
    const left = pointers.current.size;
    if (st.mode === 'pinch') {
      if (left === 1) { // один палец остался — продолжаем двигать
        const p = [...pointers.current.values()][0];
        st.mode = 'pan'; st.p0 = p; st.z0 = { ...z.current };
      }
      if (left === 0) { z.current = clamp(z.current); paintImg(true); st.mode = ''; }
      return;
    }
    if (left > 0) return;
    const dt = Math.max(1, Date.now() - st.t0);
    if (st.mode === 'swipe') {
      const w = size().w;
      const fast = Math.abs(st.dx) > 40 && Math.abs(st.dx) / dt > 0.5;
      if (st.dx < -w * 0.22 || (fast && st.dx < 0)) goTo(i + 1);
      else if (st.dx > w * 0.22 || (fast && st.dx > 0)) goTo(i - 1);
      else paintTrack(0, 0, true);
    } else if (st.mode === 'down') {
      if (st.dy > 120 || (st.dy > 50 && st.dy / dt > 0.6)) ui.close();
      else paintTrack(0, 0, true);
    } else if (st.mode === '') {
      // тап: двойной — зум к точке / обратно
      const p = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      if (now - lastTap.current.t < 300 && Math.hypot(p.x - lastTap.current.p.x, p.y - lastTap.current.p.y) < 30) {
        lastTap.current.t = 0;
        if (z.current.s > 1.01) z.current = { s: 1, x: 0, y: 0 };
        else {
          const { w, h, dw, dh } = imgBox();
          const fit = w / dw; // во сколько раз увеличить, чтобы фото встало по ширине
          if (fit > 1.3) {
            // длинный чек: по ширине экрана, с начала — дальше листаем пальцем вниз
            z.current = clamp({ s: fit, x: 0, y: (dh * fit - h) / 2 });
          } else {
            const r = rel(p);
            z.current = clamp({ s: 2.5, x: -1.5 * r.x, y: -1.5 * r.y });
          }
        }
        paintImg(true);
      } else {
        lastTap.current = { t: now, p };
      }
    }
    st.mode = '';
  };

  const ph = photos[i];
  if (!ph) return null;

  return (
    <>
      <div className="viewer-top">
        <div className="grow">
          <div className="viewer-title">{n > 1 ? `${ph.title} · ${i + 1} из ${n}` : ph.title}</div>
          {ph.caption && <div className={'viewer-cap' + (ph.tone ? ' rs-' + ph.tone : '')}>{ph.caption}</div>}
        </div>
        <button className="viewer-x" aria-label="Закрыть" onClick={() => ui.close()}>{Icon.close}</button>
      </div>

      <div
        className="viewer-stage"
        ref={stage}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="viewer-track" ref={track}>
          {photos.map((p, j) => (
            <div className="viewer-slide" key={p.key}>
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.title}
                  draggable={false}
                  ref={j === i ? (el) => { img.current = el; } : undefined}
                />
              ) : (
                <span className="spinner" />
              )}
            </div>
          ))}
        </div>
        {n > 1 && (
          <>
            <button className="viewer-nav prev" aria-label="Предыдущее фото" disabled={i === 0} onClick={() => goTo(i - 1)}>{Icon.back}</button>
            <button className="viewer-nav next" aria-label="Следующее фото" disabled={i === n - 1} onClick={() => goTo(i + 1)}>{Icon.back}</button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="viewer-dots" aria-hidden="true">
          {photos.map((p, j) => <span key={p.key} className={j === i ? 'on' : ''} />)}
        </div>
      )}
      {footer && <div className="viewer-foot">{footer(i)}</div>}
      {overlay}
    </>
  );
}

/**
 * Вопрос поверх фото. Закрыть можно кнопкой «Отмена», смахнув панель вниз
 * или тапнув по затемнённому фото — как обычную шторку.
 */
export function ViewerAsk({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number; id: number } | null>(null);
  const [leaving, setLeaving] = useState(false);

  const paint = (dy: number, animate: boolean) => {
    if (panel.current) {
      panel.current.style.transition = animate ? 'transform .2s ease' : 'none';
      panel.current.style.transform = dy ? `translateY(${dy}px)` : '';
    }
    if (shade.current) shade.current.style.opacity = String(Math.max(0, 1 - dy / 260));
  };
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    paint(panel.current?.offsetHeight ?? 300, true);
    setTimeout(onClose, 180);
  };

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, t0: Date.now(), dy: 0, id: e.pointerId };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    paint(d.dy, false);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const fast = d.dy > 40 && d.dy / Math.max(1, Date.now() - d.t0) > 0.5;
    if (d.dy > 80 || fast) close();
    else paint(0, true);
  };

  return (
    <>
      <div className="viewer-shade" ref={shade} onClick={close} />
      <div className="viewer-ask" ref={panel} role="alertdialog" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="viewer-grab" aria-hidden="true" />
        {children}
        <button className="viewer-link" onClick={close}>Отмена</button>
      </div>
    </>
  );
}
