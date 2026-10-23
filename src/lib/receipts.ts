// Несколько чеков (или скриншотов билетов) у одной встречи
import type { BarEvent, Item, Receipt } from './types';
import { itemTotal } from './calc';
import { money } from './format';

export const receiptsOf = (ev: BarEvent): Receipt[] => ev.receipts ?? [];

/** 1 чек, 2 чека, 5 чеков */
export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
}

/** «Чек», а если их несколько — «Чек 2»; для кино — «Билеты 2» */
export function receiptLabel(ev: BarEvent, r: Receipt) {
  const list = receiptsOf(ev);
  const base = r.kind === 'tickets' ? 'Билеты' : 'Чек';
  return list.length > 1 ? `${base} ${list.findIndex((x) => x.id === r.id) + 1}` : base;
}

/** «Чек» / «3 чека», «Билеты» / «2 скриншота» */
export function receiptsTitle(ev: BarEvent, tickets: boolean) {
  const n = receiptsOf(ev).length;
  if (n <= 1) return tickets ? 'Билеты' : 'Чек';
  return tickets ? `${n} ${plural(n, 'скриншот', 'скриншота', 'скриншотов')}` : `${n} ${plural(n, 'чек', 'чека', 'чеков')}`;
}

export type ReceiptState = 'busy' | 'warn' | 'error' | 'ok';
export function receiptState(r: Receipt): ReceiptState {
  if (r.status.startsWith('⏳')) return 'busy';
  if (r.status.startsWith('❌')) return 'error';
  if (r.status.startsWith('⚠️')) return 'warn';
  return 'ok';
}

/** Статус без значка в начале */
export const plainStatus = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '');

export const receiptItems = (ev: BarEvent, r: Receipt): Item[] => ev.items.filter((it) => it.receiptId === r.id);

/** Короткая строка про чек: «12 поз. · 4 300 ₽», «Распознаю…», «не сходится итог» */
export function receiptLine(ev: BarEvent, r: Receipt) {
  const st = receiptState(r);
  if (st === 'busy') return 'Распознаю…';
  if (st === 'error') return plainStatus(r.status) || 'Ошибка распознавания';
  const items = receiptItems(ev, r);
  if (!items.length) return plainStatus(r.status) || 'Без позиций';
  const sum = items.reduce((s, it) => s + itemTotal(it), 0);
  return `${items.length} поз. · ${money(sum, ev.currency)}${st === 'warn' ? ' · не сходится итог' : ''}`;
}

/** Сводка для карточки-стопки */
export function receiptsSummary(ev: BarEvent): { text: string; state: ReceiptState } {
  const list = receiptsOf(ev);
  const busy = list.filter((r) => receiptState(r) === 'busy');
  if (busy.length) return { text: busy.length > 1 ? `Распознаю: ${busy.length}…` : 'Распознаю…', state: 'busy' };
  const bad = list.find((r) => receiptState(r) === 'error');
  if (bad) return { text: list.length > 1 ? `${receiptLabel(ev, bad)}: ошибка распознавания` : plainStatus(bad.status), state: 'error' };
  const warn = list.find((r) => receiptState(r) === 'warn');
  const linked = ev.items.filter((it) => it.receiptId && list.some((r) => r.id === it.receiptId));
  if (!linked.length) {
    // старые встречи: позиции не привязаны к чеку — показываем статус последнего
    const last = list[list.length - 1];
    return { text: last ? plainStatus(last.status) || 'Нажми, чтобы посмотреть' : '', state: warn ? 'warn' : 'ok' };
  }
  const sum = linked.reduce((s, it) => s + itemTotal(it), 0);
  const base = `${linked.length} поз. · ${money(sum, ev.currency)}`;
  if (warn) return { text: list.length > 1 ? `${base} · ${receiptLabel(ev, warn).toLowerCase()}: не сходится итог` : `${base} · не сходится итог`, state: 'warn' };
  return { text: base, state: 'ok' };
}

export type ItemGroup = { key: string; title: string; items: Item[] };

/** Позиции по чекам; «Вручную» — в конце. Одна группа — значит, разделы не нужны */
export function itemGroups(ev: BarEvent): ItemGroup[] {
  const list = receiptsOf(ev);
  const known = new Set(list.map((r) => r.id));
  const groups: ItemGroup[] = list.map((r) => ({ key: r.id, title: receiptLabel(ev, r), items: receiptItems(ev, r) }));
  groups.push({ key: 'manual', title: 'Вручную', items: ev.items.filter((it) => !it.receiptId || !known.has(it.receiptId)) });
  return groups.filter((g) => g.items.length);
}
