import type { BarEvent, Item } from './types';

export const itemTotal = (it: Item) => it.price * it.qty;

export const evTotal = (ev: BarEvent) => ev.items.reduce((s, it) => s + itemTotal(it), 0);

export const tipAmount = (ev: BarEvent) =>
  ev.tipsMode === 'pct' ? (evTotal(ev) * (ev.tips || 0)) / 100 : ev.tips || 0;

export const evWithTips = (ev: BarEvent) => evTotal(ev) + tipAmount(ev);

/** Сумма позиций человека (без чаевых) */
export function foodShare(ev: BarEvent, pid: string): number {
  return ev.items.reduce((s, it) => {
    if (it.splitMode === 'qty') return s + it.price * (it.split[pid] || 0);
    return it.consumers.includes(pid) && it.consumers.length ? s + itemTotal(it) / it.consumers.length : s;
  }, 0);
}

/** Часть человека: позиции + доля чаевых пропорционально заказу */
export function owedOf(ev: BarEvent, pid: string) {
  const food = foodShare(ev, pid);
  const assigned = ev.members.reduce((s, m) => s + foodShare(ev, m), 0);
  const tip = assigned > 0 ? (tipAmount(ev) * food) / assigned : 0;
  return { food, tip, owed: food + tip };
}

/**
 * Баланс: плательщику должны все, кто ещё не перевёл;
 * кто перевёл — в нуле; без плательщика баланс 0.
 */
export function stats(ev: BarEvent, pid: string) {
  const o = owedOf(ev, pid);
  const isPayer = ev.payer === pid;
  const settled = ev.settled.includes(pid);
  let balance = 0;
  if (ev.payer) {
    if (isPayer) {
      balance = ev.members
        .filter((m) => m !== pid && !ev.settled.includes(m))
        .reduce((s, m) => s + owedOf(ev, m).owed, 0);
    } else if (!settled) {
      balance = -o.owed;
    }
  }
  return { ...o, isPayer, settled, balance };
}

/** Баланс человека по всем встречам, отдельно по каждой валюте */
export function balancesByCurrency(events: BarEvent[], pid: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of events) {
    if (!e.members.includes(pid)) continue;
    const cur = e.currency || 'RUB';
    out[cur] = (out[cur] ?? 0) + stats(e, pid).balance;
  }
  return out;
}

/** Баланс человека по всем встречам (без учёта валют) */
export const totalBalance = (events: BarEvent[], pid: string) =>
  events.filter((e) => e.members.includes(pid)).reduce((s, e) => s + stats(e, pid).balance, 0);

/** Раскидать штуки поровну: 7 на троих → 3, 2, 2 */
export function evenSplit(ids: string[], qty: number): Record<string, number> {
  const out: Record<string, number> = {};
  ids.forEach((id, i) => {
    out[id] = Math.floor(qty / ids.length) + (i < qty % ids.length ? 1 : 0);
  });
  return out;
}

/** Что из позиций досталось человеку: для шторки участника */
export function personItems(ev: BarEvent, pid: string) {
  return ev.items
    .map((it) => {
      if (it.splitMode === 'qty') {
        const n = it.split[pid] || 0;
        return n > 0 ? { id: it.id, name: it.name, detail: `${n} из ${it.qty} шт.`, amount: it.price * n } : null;
      }
      if (!it.consumers.includes(pid) || !it.consumers.length) return null;
      const k = it.consumers.length;
      const total = itemTotal(it);
      const detail = k === 1 ? (it.qty > 1 ? `${it.qty} шт.` : 'целиком') : `пополам на ${k}`.replace('пополам на 2', 'пополам').replace(/пополам на (\d+)/, 'на $1 чел.');
      return { id: it.id, name: it.name, detail, amount: total / k };
    })
    .filter((x): x is { id: string; name: string; detail: string; amount: number } => x !== null);
}
