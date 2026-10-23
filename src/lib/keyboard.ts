// Экранная клавиатура: шторки встают над ней, кнопки «Сохранить» остаются видны.
// Android (Chrome) сам уменьшает страницу — это включено в index.html (interactive-widget=resizes-content).
// iPhone так не умеет — там считаем высоту клавиатуры через visualViewport.
// В CSS: --kb — высота клавиатуры, --vvh — видимая высота экрана, html.kb-open — клавиатура открыта.

const isEditable = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color', 'date', 'time'].includes(el.type)) || (el as HTMLElement).isContentEditable);

export function watchKeyboard() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  let fullH = window.innerHeight; // высота без клавиатуры

  const apply = () => {
    const vh = vv ? vv.height : window.innerHeight;
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    if (!isEditable(document.activeElement)) fullH = Math.max(window.innerHeight, vh);
    const open = isEditable(document.activeElement) && (kb > 80 || fullH - vh > 120);
    root.style.setProperty('--kb', `${open ? kb : 0}px`);
    root.style.setProperty('--vvh', `${Math.round(vh)}px`);
    root.classList.toggle('kb-open', open);
  };

  // поле под клавиатурой — подкручиваем, чтобы было видно (и его, и кнопки рядом)
  const reveal = () => {
    const el = document.activeElement as HTMLElement | null;
    if (!isEditable(el)) return;
    // страница (или шторка) просто поднимается: поле — в верхнюю часть видимого,
    // под ним остаётся место для следующих полей и кнопки
    setTimeout(() => { if (document.activeElement === el) el!.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
  };

  vv?.addEventListener('resize', () => { apply(); reveal(); });
  vv?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => { fullH = 0; setTimeout(apply, 300); });
  document.addEventListener('focusin', () => { apply(); setTimeout(apply, 350); });
  document.addEventListener('focusout', () => setTimeout(apply, 50));
  apply();
}
