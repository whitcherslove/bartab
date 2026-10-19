export const money = (n: number) => Math.round(n).toLocaleString('ru-RU');

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function fdate(iso: string) {
  const d = new Date(iso + 'T12:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function todayIso() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function hueOf(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

/** Число из поля ввода: понимает и запятую, и точку */
export const parseNum = (v: string) => Number(v.replace(',', '.').trim()) || 0;

/** Переключить элемент в списке */
export const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
