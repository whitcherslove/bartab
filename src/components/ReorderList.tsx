import { useRef, type ReactNode } from 'react';
import { Icon } from './Icons';

/**
 * Список с перетаскиванием за ручку ⠿.
 * Тянешь строку — остальные расступаются; у края экрана список сам прокручивается.
 */
export function ReorderList<T extends { id: string }>({ items, onMove, render }: {
  items: T[];
  onMove: (from: number, to: number) => void;
  render: (item: T) => ReactNode;
}) {
  const rows = useRef(new Map<string, HTMLDivElement>());
  const drag = useRef<{
    from: number; to: number; y0: number; sy0: number; tops: number[]; hs: number[]; shift: number; pid: number; lastY: number; raf: number;
  } | null>(null);

  const els = () => items.map((it) => rows.current.get(it.id)!);

  const layout = () => {
    const d = drag.current;
    if (!d) return;
    const dy = d.lastY - d.y0 + (window.scrollY - d.sy0);
    const center = d.tops[d.from] + d.hs[d.from] / 2 + dy;
    let to = d.from;
    for (let k = d.from + 1; k < items.length; k++) if (center > d.tops[k] + d.hs[k] / 2) to = k;
    for (let k = d.from - 1; k >= 0; k--) if (center < d.tops[k] + d.hs[k] / 2) to = k;
    d.to = to;
    els().forEach((el, k) => {
      if (!el) return;
      if (k === d.from) { el.style.transform = `translateY(${dy}px)`; return; }
      let off = 0;
      if (d.from < to && k > d.from && k <= to) off = -d.shift;
      if (d.from > to && k < d.from && k >= to) off = d.shift;
      el.style.transform = off ? `translateY(${off}px)` : '';
    });
  };

  // у верхнего/нижнего края — прокручиваем
  const autoscroll = () => {
    const d = drag.current;
    if (!d) return;
    const edge = 90;
    const v = d.lastY < edge ? -Math.ceil((edge - d.lastY) / 8) : d.lastY > window.innerHeight - edge - 70 ? Math.ceil((d.lastY - (window.innerHeight - edge - 70)) / 8) : 0;
    if (v) { window.scrollBy(0, v); layout(); }
    d.raf = requestAnimationFrame(autoscroll);
  };

  const start = (e: React.PointerEvent, i: number) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const list = els();
    const rects = list.map((el) => el.getBoundingClientRect());
    const sy = window.scrollY;
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
    drag.current = {
      from: i, to: i, y0: e.clientY, sy0: sy, lastY: e.clientY, pid: e.pointerId, raf: 0,
      tops: rects.map((r) => r.top + sy), hs: rects.map((r) => r.height), shift: rects[i].height + gap,
    };
    list.forEach((el, k) => {
      el.style.transition = k === i ? 'none' : 'transform .2s ease';
      if (k === i) el.classList.add('dragging');
    });
    try { navigator.vibrate?.(8); } catch { /* нет вибрации */ }
    drag.current.raf = requestAnimationFrame(autoscroll);
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    d.lastY = e.clientY;
    layout();
  };

  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pid) return;
    cancelAnimationFrame(d.raf);
    drag.current = null;
    els().forEach((el) => { if (!el) return; el.style.transition = 'none'; el.style.transform = ''; el.classList.remove('dragging'); });
    if (d.to !== d.from) onMove(d.from, d.to);
  };

  return (
    <div className="list reorder-list">
      {items.map((it, i) => (
        <div key={it.id} className="row reorder-row" ref={(el) => { if (el) rows.current.set(it.id, el); else rows.current.delete(it.id); }}>
          {render(it)}
          <span
            className="drag-handle"
            role="button"
            aria-label="Перетащить"
            onPointerDown={(e) => start(e, i)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >{Icon.grip}</span>
        </div>
      ))}
    </div>
  );
}
