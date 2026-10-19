import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';
import { canPrompt, isInAppBrowser, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { InstallHelp } from './InstallCard';

const HIDE_KEY = 'bartab-install-hidden-until';
const isPhone = () => window.matchMedia('(pointer: coarse)').matches || /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/** Плашка «Установить» — только в браузере на телефоне, в установленном приложении её нет */
export function InstallBanner() {
  const ui = useUI();
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try { return Date.now() < Number(localStorage.getItem(HIDE_KEY) || 0); } catch { return false; }
  });
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);

  if (hidden || isStandalone() || !isPhone()) return null;
  if (!canPrompt() && !isIOS() && !isInAppBrowser()) return null; // браузер не умеет ставить приложения

  const install = async () => {
    if (canPrompt()) {
      if (await promptInstall()) ui.toast('BarTab появится на экране телефона');
      return;
    }
    ui.open(
      <>
        <h4>Поставь BarTab на телефон</h4>
        <InstallHelp />
      </>,
    );
  };

  const hide = () => {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + 14 * 24 * 3600 * 1000)); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className="install-banner" role="region" aria-label="Установка приложения">
      <span className="ib-emoji" aria-hidden="true">📲</span>
      <span className="ib-text">Поставь BarTab на телефон</span>
      <button className="btn primary sm" onClick={install}>Установить</button>
      <button className="ib-close" aria-label="Скрыть на две недели" onClick={hide}>×</button>
    </div>
  );
}
