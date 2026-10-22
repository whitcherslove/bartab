import { useRef, useState, type TouchEvent } from 'react';

/**
 * Свайп влево/вправо по содержимому, чтобы переключать вкладки-сегменты.
 * Срабатывает только на явное горизонтальное движение; не мешает прокрутке,
 * полям ввода, рядам с собственной горизонтальной прокруткой и системному жесту «назад» от края.
 */
export function useSwipeTabs<T extends string>(tabs: readonly T[], current: T, setCurrent: (t: T) => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [dir, setDir] = useState<'left' | 'right' | ''>('');

  const go = (t: T) => {
    const i = tabs.indexOf(current), j = tabs.indexOf(t);
    if (j < 0 || i === j) return;
    setDir(j > i ? 'left' : 'right');
    setCurrent(t);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    const target = e.target as HTMLElement;
    const edge = 24;
    if (e.touches.length > 1 || t.clientX < edge || t.clientX > window.innerWidth - edge
      || target.closest('input, textarea, select, .swatches, .history-strip, .event-meta, [data-no-swipe]')) {
      start.current = null;
      return;
    }
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - s.t > 700) return;
    const i = tabs.indexOf(current);
    const next = dx < 0 ? tabs[i + 1] : tabs[i - 1];
    if (next) go(next);
  };

  return {
    /** обработчики для контейнера содержимого */
    bind: { onTouchStart, onTouchEnd },
    /** класс для въезда содержимого с нужной стороны */
    enterClass: dir ? `seg-enter-${dir}` : '',
    /** переключение по кнопкам сегмента — с той же анимацией */
    go,
  };
}
