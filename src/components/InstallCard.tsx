import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';
import { canPrompt, isInAppBrowser, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';

/** Как поставить BarTab на телефон: кнопка (Android), подсказка (iPhone) или совет открыть в браузере */
export function InstallHelp({ compact }: { compact?: boolean }) {
  const ui = useUI();
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  if (isStandalone()) return null;

  if (isInAppBrowser()) {
    return (
      <div className="install-help">
        <b>Открой ссылку в браузере</b>
        <span>Из Telegram или Instagram приложение не установить. Нажми «⋯» и выбери «Открыть в {isIOS() ? 'Safari' : 'Chrome'}».</span>
      </div>
    );
  }

  if (canPrompt()) {
    const install = async () => { if (await promptInstall()) ui.toast('BarTab появится на экране телефона'); };
    return (
      <div className="install-help">
        {!compact && <span>Откроется как обычное приложение, без браузера.</span>}
        <button className="btn primary block" onClick={install}>Установить на телефон</button>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div className="install-help">
        <ol className="steps" style={{ margin: 0 }}>
          <li>Нажми «Поделиться» внизу Safari (квадрат со стрелкой)</li>
          <li>Выбери «На экран «Домой»» → «Добавить»</li>
          <li>Открой BarTab с иконки и войди ещё раз — iPhone хранит данные приложения отдельно</li>
        </ol>
      </div>
    );
  }

  return null;
}

/** Карточка в профиле */
export function InstallCard() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone() || (!canPrompt() && !isIOS() && !isInAppBrowser())) return null;
  return (
    <>
      <h3>Приложение на телефоне</h3>
      <div className="list form-card"><InstallHelp /></div>
    </>
  );
}
