import { useLayoutEffect, useRef, type RefObject } from 'react';
import { reducedMotion as rm } from './ui';

// анимации нет (старый браузер) или пользователь просил меньше движения
const reducedMotion = () => rm() || typeof Element === 'undefined' || !('animate' in Element.prototype);

/**
 * Плавный переезд элементов при смене порядка (FLIP):
 * запоминаем, где элементы были, и анимируем их на новые места.
 * Дети контейнера должны иметь атрибут data-flip="уникальный ключ".
 */
export function useFlip(container: RefObject<HTMLElement | null>, key: string) {
  const prev = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-flip]'));
    const next = new Map<string, DOMRect>();
    for (const it of items) next.set(it.dataset.flip!, it.getBoundingClientRect());
    if (!reducedMotion()) {
      for (const it of items) {
        const was = prev.current.get(it.dataset.flip!);
        const now = next.get(it.dataset.flip!)!;
        if (!was) continue;
        const dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        it.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.25, 1.2, .4, 1)' });
      }
    }
    prev.current = next;
  }, [container, key]);
}

/** Салют из конфетти из точки на экране */
export function confetti(from: HTMLElement | null) {
  if (reducedMotion()) return;
  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
  const colors = ['#F2A340', '#5FC79A', '#F0718F', '#A98DF5', '#6BB2F0', '#FFF6E8'];
  for (let i = 0; i < 36; i++) {
    const p = document.createElement('span');
    p.className = 'confetti-piece';
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colors[i % colors.length];
    document.body.appendChild(p);
    const angle = (Math.PI * 2 * i) / 36 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 120;
    const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist - 80;
    const anim = p.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + 160}px)) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2, .7, .4, 1)' });
    anim.onfinish = () => p.remove();
  }
}
