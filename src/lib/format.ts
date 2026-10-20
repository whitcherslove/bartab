// Валюта отображения (из профиля). Пересчёта курсов нет — это просто подпись к суммам.
export const CURRENCIES: { code: string; label: string }[] = [
  { code: 'RUB', label: '₽ Рубль' }, { code: 'USD', label: '$ Доллар' }, { code: 'EUR', label: '€ Евро' },
  { code: 'GBP', label: '£ Фунт' }, { code: 'TRY', label: '₺ Лира' }, { code: 'GEL', label: '₾ Лари' },
  { code: 'KZT', label: '₸ Тенге' }, { code: 'AMD', label: '֏ Драм' }, { code: 'AED', label: 'Дирхам ОАЭ' },
  { code: 'THB', label: '฿ Бат' }, { code: 'RSD', label: 'Динар' }, { code: 'CNY', label: '¥ Юань' },
];
const formatters = new Map<string, Intl.NumberFormat>();
function formatter(code: string) {
  let f = formatters.get(code);
  if (!f) {
    try { f = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: code, maximumFractionDigits: 0, minimumFractionDigits: 0 }); }
    catch { f = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }); }
    formatters.set(code, f);
  }
  return f;
}
/** Валюта по умолчанию — из профиля (для новых встреч) */
let defaultCurrency = 'RUB';
export function setCurrency(code: string) { if (code) defaultCurrency = code; }
export const getDefaultCurrency = () => defaultCurrency;
/** Сумма с валютой. Для встречи передавай её валюту: money(x, ev.currency) */
export const money = (n: number, code?: string) => formatter(code || defaultCurrency).format(Math.round(n));

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

/** id новых записей — сразу в формате базы (uuid). На старых телефонах randomUUID нет — собираем сами. */
export const uid = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/** Глубокая копия; на старых телефонах нет structuredClone */
export const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/** Число из поля ввода: понимает и запятую, и точку */
export const parseNum = (v: string) => Number(v.replace(',', '.').trim()) || 0;

/** Переключить элемент в списке */
export const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
