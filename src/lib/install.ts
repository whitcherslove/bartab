// Установка приложения на телефон.
// Событие «можно установить» браузер присылает один раз и рано — ловим его сразу при запуске.

export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const INSTALLED_KEY = 'bartab-installed';
const DISMISS_KEY = 'bartab-install-hidden-until';
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Отметить, что приложение установлено — больше нигде не предлагаем */
export function markInstalled() { set(INSTALLED_KEY, '1'); deferred = null; notify(); }

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; notify(); });
window.addEventListener('appinstalled', () => markInstalled());

export const canPrompt = () => !!deferred;
export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Показать системное окно установки (Android, Chrome). true — согласились */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === 'accepted') markInstalled(); else notify();
  return outcome === 'accepted';
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Браузер внутри Telegram/Instagram/VK и т. п. — там установить нельзя */
export const isInAppBrowser = () => /Telegram|Instagram|FBAN|FBAV|VKClient|\bLine\b|Twitter/i.test(navigator.userAgent);

export type Browser = 'yandex' | 'samsung' | 'firefox' | 'edge' | 'chrome' | 'safari' | 'chrome-ios' | 'other';

/** Какой браузер — чтобы показать нужную инструкцию */
export function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/YaBrowser|YaSearchBrowser/i.test(ua)) return 'yandex';
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/EdgA|EdgiOS|Edg\//i.test(ua)) return 'edge';
  if (/CriOS/i.test(ua)) return 'chrome-ios';
  if (isIOS()) return 'safari';
  if (/Chrome|Chromium/i.test(ua)) return 'chrome';
  return 'other';
}

export const isPhone = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Установлено: запущено с иконки или установка прошла в этом браузере */
export const isInstalled = () => isStandalone() || get(INSTALLED_KEY) === '1';

/** «Не сейчас» / «Понятно» — не предлагать 2 недели */
export function dismissInstall() { set(DISMISS_KEY, String(Date.now() + 14 * 24 * 3600 * 1000)); notify(); }
export const isDismissed = () => Date.now() < Number(get(DISMISS_KEY) || 0);

/** Стоит ли сейчас предлагать установку (плашка, шторки) */
export const shouldOfferInstall = () => isPhone() && !isInstalled() && !isDismissed();

// запустили с иконки — запоминаем (на Android хранилище общее с браузером)
if (isStandalone()) set(INSTALLED_KEY, '1');
