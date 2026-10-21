import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';
import { canPrompt, dismissInstall, onInstallChange, promptInstall, shouldOfferInstall } from '../lib/install';
import { InstallSheet } from '../sheets/InstallSheet';

/** Плашка «Установить»: только в браузере на телефоне, пока не установлено и не отказались, и когда нет шторки */
export function InstallBanner() {
  const ui = useUI();
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  if (ui.hasSheet || !shouldOfferInstall()) return null;

  const install = async () => {
    if (canPrompt()) {
      if (await promptInstall()) ui.toast('BarTab появится на экране телефона');
      return;
    }
    ui.open(<InstallSheet />);
  };

  return (
    <div className="install-banner" role="region" aria-label="Установка приложения">
      <span className="ib-emoji" aria-hidden="true">📲</span>
      <span className="ib-text">Поставь BarTab на телефон</span>
      <button className="btn primary sm" onClick={install}>Установить</button>
      <button className="ib-close" aria-label="Не сейчас" onClick={dismissInstall}>×</button>
    </div>
  );
}
