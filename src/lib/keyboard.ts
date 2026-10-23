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

  // клавиатура открылась — поднимаем содержимое: поле встаёт наверх видимой части,
  // всё, что ниже (следующие поля, кнопка «Сохранить»), видно под ним.
  // Если ниже мало — прокрутится до самого низа.
  const reveal = () => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !isEditable(el) || !root.classList.contains('kb-open')) return; // на компьютере — не трогаем
    const label = (el.closest('.field') as HTMLElement | null) ?? el; // вместе с подписью над полем
    const sheet = el.closest('.sheet') as HTMLElement | null;
    if (sheet) {
      const top = label.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - 12;
      sheet.scrollTo({ top: Math.max(0, top) });
    } else {
      const head = (document.querySelector('.top') as HTMLElement | null)?.offsetHeight ?? 0;
      window.scrollTo({ top: Math.max(0, label.getBoundingClientRect().top + window.scrollY - head - 12) });
    }
  };
  // клавиатура выезжает не сразу — поднимаем несколько раз, пока она не встанет
  let timers: number[] = [];
  const revealSoon = () => {
    timers.forEach(clearTimeout);
    timers = [80, 250, 450, 700].map((t) => window.setTimeout(() => requestAnimationFrame(reveal), t));
  };

  // поднимаем только когда выезжает клавиатура (сильное изменение высоты),
  // а не когда в браузере прячется адресная строка
  let lastH = vv?.height ?? window.innerHeight;
  vv?.addEventListener('resize', () => {
    apply();
    const h = vv.height;
    if (Math.abs(h - lastH) > 100 && root.classList.contains('kb-open')) revealSoon();
    lastH = h;
  });
  vv?.addEventListener('scroll', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => { fullH = 0; setTimeout(apply, 300); });
  document.addEventListener('focusin', () => { apply(); setTimeout(apply, 350); revealSoon(); });
  document.addEventListener('focusout', () => setTimeout(apply, 50));
  apply();
}
