// Установка приложения на телефон.
// Событие «можно установить» браузер присылает один раз и рано — ловим его сразу при запуске.

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
window.addEventListener('appinstalled', () => { deferred = null; notify(); });

export const canPrompt = () => !!deferred;
export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Показать системное окно установки (Android, Chrome). true — согласились */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  notify();
  return outcome === 'accepted';
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Браузер внутри Telegram/Instagram/VK и т. п. — там установить нельзя */
export const isInAppBrowser = () => /Telegram|Instagram|FBAN|FBAV|VKClient|\bLine\b|Twitter/i.test(navigator.userAgent);
