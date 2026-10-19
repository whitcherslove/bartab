import { describe, expect, it } from 'vitest';
import type { BarEvent, Item } from '../src/lib/types';
import { evenSplit, evWithTips, owedOf, stats, tipAmount } from '../src/lib/calc';

const item = (p: Partial<Item>): Item => ({
  id: 'x', name: 'x', price: 0, qty: 1, splitMode: 'equal', consumers: [], split: {}, ...p,
});

const event = (p: Partial<BarEvent>): BarEvent => ({
  id: 'e', date: '2026-10-19', placeId: '', members: ['a', 'b', 'c'],
  tips: 0, tipsMode: 'sum', payer: '', settled: [], status: '', items: [], ...p,
});

describe('деление позиций', () => {
  it('поровну: 900 на троих — по 300', () => {
    const ev = event({ items: [item({ price: 900, consumers: ['a', 'b', 'c'] })] });
    expect(owedOf(ev, 'a').owed).toBe(300);
    expect(owedOf(ev, 'c').owed).toBe(300);
  });

  it('по штукам: 6 пива по 350, выпили 3/2/1', () => {
    const ev = event({ items: [item({ price: 350, qty: 6, splitMode: 'qty', consumers: ['a', 'b', 'c'], split: { a: 3, b: 2, c: 1 } })] });
    expect(owedOf(ev, 'a').owed).toBe(1050);
    expect(owedOf(ev, 'b').owed).toBe(700);
    expect(owedOf(ev, 'c').owed).toBe(350);
  });

  it('кто не отмечен в позиции — не платит за неё', () => {
    const ev = event({ items: [item({ price: 600, consumers: ['a', 'b'] })] });
    expect(owedOf(ev, 'c').owed).toBe(0);
  });

  it('раскидывает штуки поровну с остатком', () => {
    expect(evenSplit(['a', 'b', 'c'], 7)).toEqual({ a: 3, b: 2, c: 2 });
  });
});

describe('чаевые', () => {
  const items = [
    item({ price: 1000, consumers: ['a'] }),
    item({ price: 500, consumers: ['b'] }),
    item({ price: 500, consumers: ['c'] }),
  ];

  it('суммой делятся пропорционально заказу', () => {
    const ev = event({ items, tips: 200, tipsMode: 'sum' });
    expect(tipAmount(ev)).toBe(200);
    expect(owedOf(ev, 'a').tip).toBe(100);
    expect(owedOf(ev, 'b').tip).toBe(50);
    expect(evWithTips(ev)).toBe(2200);
  });

  it('процентом считаются от счёта', () => {
    const ev = event({ items, tips: 10, tipsMode: 'pct' });
    expect(tipAmount(ev)).toBe(200);
    expect(owedOf(ev, 'a').owed).toBe(1100);
  });

  it('сумма частей всех людей равна счёту с чаевыми', () => {
    const ev = event({ items, tips: 15, tipsMode: 'pct' });
    const sum = ev.members.reduce((s, m) => s + owedOf(ev, m).owed, 0);
    expect(sum).toBeCloseTo(evWithTips(ev));
  });
});

describe('балансы', () => {
  const items = [item({ price: 900, consumers: ['a', 'b', 'c'] })];

  it('без плательщика все в нуле', () => {
    const ev = event({ items });
    expect(stats(ev, 'a').balance).toBe(0);
  });

  it('плательщику должны все, кто ещё не перевёл', () => {
    const ev = event({ items, payer: 'a' });
    expect(stats(ev, 'a').balance).toBe(600);
    expect(stats(ev, 'b').balance).toBe(-300);
  });

  it('кто перевёл — в нуле, а у плательщика долг уменьшается', () => {
    const ev = event({ items, payer: 'a', settled: ['b'] });
    expect(stats(ev, 'b').balance).toBe(0);
    expect(stats(ev, 'a').balance).toBe(300);
    expect(stats(ev, 'c').balance).toBe(-300);
  });
});
