import { useEffect, useState } from 'react';
import { useOptionalUI } from '../lib/ui';
import { canPrompt, detectBrowser, isInAppBrowser, isIOS, isPhone, isStandalone, onInstallChange, promptInstall } from '../lib/install';

const Steps = ({ items }: { items: string[] }) => (
  <ol className="steps" style={{ margin: 0 }}>{items.map((t) => <li key={t}>{t}</li>)}</ol>
);

/** Как установить BarTab: кнопка, если браузер умеет, иначе инструкция для конкретного браузера */
export function InstallHelp({ compact }: { compact?: boolean }) {
  const ui = useOptionalUI();
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  if (isStandalone()) {
    return <div className="install-help"><b>BarTab уже установлен ✅</b><span>Открывай его с иконки на экране.</span></div>;
  }

  if (isInAppBrowser()) {
    return (
      <div className="install-help">
        <b>Открой ссылку в браузере</b>
        <span>Из Telegram, Instagram или VK приложение не установить. Нажми «⋯» вверху и выбери «Открыть в {isIOS() ? 'Safari' : 'браузере'}».</span>
      </div>
    );
  }

  if (canPrompt()) {
    const install = async () => { if (await promptInstall()) ui?.toast('BarTab появится на экране телефона'); };
    return (
      <div className="install-help">
        {!compact && <span>Откроется как обычное приложение, без браузера.</span>}
        <button className="btn primary block" onClick={install}>Установить на телефон</button>
      </div>
    );
  }

  const b = detectBrowser();
  let steps: string[];
  if (b === 'safari') steps = ['Нажми «Поделиться» внизу Safari (квадрат со стрелкой вверх)', 'Пролистай и выбери «На экран „Домой“» → «Добавить»', 'Открой BarTab с иконки и войди ещё раз — iPhone хранит данные приложения отдельно'];
  else if (b === 'chrome-ios' || (isIOS() && b !== 'other')) steps = ['Нажми «Поделиться» в адресной строке', 'Выбери «На экран „Домой“» → «Добавить»', 'Если такого пункта нет — открой ссылку в Safari'];
  else if (b === 'yandex') steps = ['Нажми меню браузера (три точки или полоски)', 'Выбери «Добавить ярлык» или «Установить приложение»', 'Подтверди — иконка BarTab появится на экране'];
  else if (b === 'samsung') steps = ['Нажми меню ☰ внизу', 'Выбери «Добавить страницу на» → «Главный экран»', 'Подтверди — иконка BarTab появится на экране'];
  else if (b === 'firefox') steps = ['Нажми меню ⋮', 'Выбери «Установить» или «Добавить на главный экран»'];
  else if (!isPhone()) steps = ['В Chrome или Edge нажми значок установки справа в адресной строке', 'Или открой меню ⋮ → «Установить BarTab»'];
  else steps = ['Нажми меню ⋮ в правом верхнем углу', 'Выбери «Установить приложение» или «Добавить на главный экран»', 'Если пункта нет — возможно, BarTab уже установлен: поищи иконку на экране'];

  return <div className="install-help"><Steps items={steps} /></div>;
}

/** Карточка в профиле — только в браузере */
export function InstallCard() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone()) return null;
  return (
    <>
      <h3>Приложение на телефоне</h3>
      <div className="list form-card"><InstallHelp /></div>
    </>
  );
}
