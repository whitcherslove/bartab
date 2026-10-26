import { useEffect, useState } from 'react';
import { useOptionalUI } from '../lib/ui';
import {
  canPrompt, detectBrowser, dismissInstall, isInAppBrowser, isInstalled, isInstalling, isIOS, isPhone, isStandalone,
  onInstallChange, promptInstall,
} from '../lib/install';

/** Перерисовать при изменении состояния установки */
function useInstallState() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
}

/** Шаги для браузеров без кнопки установки */
export function installSteps(): string[] {
  const b = detectBrowser();
  if (b === 'safari') return [
    'Нажми «Поделиться» внизу Safari (квадрат со стрелкой вверх)',
    'Пролистай вниз и выбери «На экран „Домой“» → «Добавить»',
    'Открой BarTab с иконки и войди ещё раз по коду из письма — iPhone хранит данные приложения отдельно от Safari',
  ];
  if (b === 'chrome-ios' || (isIOS() && b !== 'other')) return ['Нажми «Поделиться» в адресной строке', 'Выбери «На экран „Домой“» → «Добавить»', 'Если такого пункта нет — открой ссылку в Safari'];
  if (b === 'yandex') return ['Нажми меню браузера (три точки или полоски)', 'Выбери «Добавить ярлык» или «Установить приложение»'];
  if (b === 'samsung') return ['Нажми меню ☰ внизу', 'Выбери «Добавить страницу на» → «Главный экран»'];
  if (b === 'firefox') return ['Нажми меню ⋮', 'Выбери «Установить» или «Добавить на главный экран»'];
  if (!isPhone()) return ['В Chrome или Edge нажми значок установки справа в адресной строке', 'Или открой меню ⋮ → «Установить BarTab»'];
  return ['Нажми меню ⋮ в правом верхнем углу', 'Выбери «Установить приложение» или «Добавить на главный экран»'];
}

const Steps = () => (
  <>
    <ol className="steps" style={{ margin: 0 }}>{installSteps().map((t) => <li key={t}>{t}</li>)}</ol>
    {isIOS() && (
      <span className="install-note">Нет пункта «На экран „Домой“»? Значит, ссылка открыта внутри Telegram или другого приложения — нажми значок Safari или «⋯» → «Открыть в Safari».</span>
    )}
  </>
);

/**
 * Одно действие установки, в зависимости от телефона:
 * кнопка (Android) → после согласия «Готово»; иначе шаги; в Telegram — «открой в браузере».
 * onDone — закрыть (кнопки «Понятно» / «Не сейчас»); без onDone кнопок закрытия нет (карточка в профиле).
 */
export function InstallAction({ onDone, doneText }: { onDone?: () => void; doneText?: string }) {
  useInstallState();
  const ui = useOptionalUI();
  const [justInstalled, setJustInstalled] = useState(false);
  const finish = (dismiss: boolean) => { if (dismiss) dismissInstall(); onDone?.(); };

  // согласились в окне установки — ждём, пока телефон поставит иконку
  if ((justInstalled || isInstalling()) && !isInstalled()) {
    return (
      <div className="install-help">
        <b>Устанавливается…</b>
        <span>Иконка BarTab появится на экране через несколько секунд.</span>
        <span className="install-note">Не появилась? На Xiaomi, Redmi, Honor и некоторых других телефонах: Настройки → Приложения → Chrome → Разрешения → «Ярлыки на рабочем столе» — разреши и установи ещё раз.</span>
        {onDone && <button className="btn primary block" onClick={() => finish(false)}>Понятно</button>}
      </div>
    );
  }

  // уже установлено
  if (isInstalled()) {
    return (
      <div className="install-help">
        <b>Готово! BarTab на экране телефона ✅</b>
        <span>{doneText ?? 'Открой его с иконки — так быстрее и удобнее.'}</span>
        {onDone && <button className="btn primary block" onClick={() => finish(false)}>Понятно</button>}
      </div>
    );
  }

  if (isInAppBrowser()) {
    return (
      <div className="install-help">
        <b>Открой ссылку в браузере</b>
        <span>Из Telegram, Instagram или VK приложение не установить. Нажми «⋯» вверху и выбери «Открыть в {isIOS() ? 'Safari' : 'браузере'}».</span>
        {onDone && <button className="btn block" onClick={() => finish(true)}>Понятно</button>}
      </div>
    );
  }

  if (canPrompt()) {
    const install = async () => {
      if (await promptInstall()) { setJustInstalled(true); ui?.toast('BarTab появится на экране телефона'); }
    };
    return (
      <div className="install-help">
        <button className="btn primary block" onClick={install}>Установить приложение</button>
        {onDone && <button className="link-btn install-later" onClick={() => finish(true)}>Не сейчас</button>}
      </div>
    );
  }

  return (
    <div className="install-help">
      <Steps />
      {onDone && <button className="btn primary block" onClick={() => finish(true)}>Понятно</button>}
    </div>
  );
}

/** Карточка в профиле — запасной путь, только в браузере и пока не установлено */
export function InstallCard() {
  useInstallState();
  if (isStandalone()) return null;
  return (
    <>
      <h3>Приложение на телефоне</h3>
      <div className="list form-card">
        <InstallAction doneText="Открой BarTab с иконки на экране телефона." />
      </div>
    </>
  );
}
