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

/** Баланс человека по всем посиделкам */
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
