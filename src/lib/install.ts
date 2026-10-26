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

// Chrome присылает «можно установить» только если приложения на телефоне НЕТ.
// Значит, старая отметка «установлено» неверна (установка не дошла до конца или приложение удалили) — снимаем её.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallEvent;
  try { localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ }
  installing = false;
  notify();
});
// а это — установка действительно завершилась
window.addEventListener('appinstalled', () => { installing = false; markInstalled(); });

/** Согласились в окне установки, но телефон ещё не подтвердил, что иконка появилась */
let installing = false;
export const isInstalling = () => installing;

export const canPrompt = () => !!deferred;
export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Показать системное окно установки (Android, Chrome). true — согласились */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  // «установлено» отмечаем только по сигналу appinstalled — согласие ещё не значит, что иконка появилась
  if (outcome === 'accepted') installing = true;
  notify();
  return outcome === 'accepted';
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Браузер внутри Telegram/Instagram/VK и т. п. — там установить нельзя.
 *  На iPhone встроенные браузеры часто не пишут о себе — их выдаёт отсутствие «Safari» в описании браузера. */
export const isInAppBrowser = () => {
  const ua = navigator.userAgent;
  if (/Telegram|Instagram|FBAN|FBAV|VKClient|\bLine\b|Twitter/i.test(ua)) return true;
  return /iphone|ipad|ipod/i.test(ua) && !/Safari\//i.test(ua);
};

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

// Android: проверяем у телефона, стоит ли приложение на самом деле (если браузер умеет отвечать)
type RelatedApps = { getInstalledRelatedApps?: () => Promise<unknown[]> };
if (!isStandalone() && get(INSTALLED_KEY) === '1' && (navigator as RelatedApps).getInstalledRelatedApps) {
  (navigator as RelatedApps).getInstalledRelatedApps!()
    .then((apps) => { if (!apps.length) { try { localStorage.removeItem(INSTALLED_KEY); } catch { /* ignore */ } notify(); } })
    .catch(() => {});
}
