import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Кнопка «Установить приложение» (Android/Chrome) или подсказка для iPhone */
export function InstallCard() {
  const ui = useUI();
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  if (evt) {
    const install = async () => {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === 'accepted') ui.toast('BarTab появится на экране телефона');
      setEvt(null);
    };
    return (
      <div className="list install-card" style={{ marginTop: 18 }}>
        <div className="row">
          <div className="grow"><div className="t">Поставь BarTab на экран телефона</div><div className="s">Откроется как обычное приложение, без браузера</div></div>
          <button className="btn primary sm" onClick={install}>Установить</button>
        </div>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div className="list install-card" style={{ marginTop: 18 }}>
        <div className="row">
          <div className="grow">
            <div className="t">Поставь BarTab на экран iPhone</div>
            <div className="s">В Safari нажми «Поделиться» (квадрат со стрелкой) → «На экран «Домой»»</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
