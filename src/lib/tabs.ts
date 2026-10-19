// Порядок вкладок и главный экран — настройка устройства.

export type TabId = 'crew' | 'events' | 'places' | 'profile';
export const TAB_LABELS: Record<TabId, string> = { crew: 'Компания', events: 'Посиделки', places: 'Бары', profile: 'Профиль' };
export const TAB_ICONS: Record<TabId, 'people' | 'glass' | 'pin' | 'user'> = { crew: 'people', events: 'glass', places: 'pin', profile: 'user' };

const DEFAULT_ORDER: TabId[] = ['crew', 'events', 'places', 'profile'];
const ORDER_KEY = 'bartab-tabs';
const HOME_KEY = 'bartab-home';
const EVENT = 'bartab-tabs-change';

const valid = (x: unknown): x is TabId => typeof x === 'string' && (DEFAULT_ORDER as string[]).includes(x);

export function getTabOrder(): TabId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') as unknown[];
    const list = saved.filter(valid);
    // добавляем вкладки, которых не было в сохранённом порядке (на случай новых)
    return [...new Set([...list, ...DEFAULT_ORDER])];
  } catch {
    return DEFAULT_ORDER;
  }
}

export function getHome(): TabId {
  try {
    const h = localStorage.getItem(HOME_KEY);
    return valid(h) ? h : 'crew';
  } catch {
    return 'crew';
  }
}

export function setTabOrder(order: TabId[]) {
  try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function setHome(tab: TabId) {
  try { localStorage.setItem(HOME_KEY, tab); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function onTabsChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
