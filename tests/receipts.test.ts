import { describe, expect, it } from 'vitest';
import type { BarEvent, Item, Receipt } from '../src/lib/types';
import { itemGroups, plural, receiptLabel, receiptsSummary, receiptsTitle } from '../src/lib/receipts';

const item = (id: string, price: number, receiptId?: string): Item => ({ id, name: id, price, qty: 1, splitMode: 'equal', consumers: [], split: {}, ...(receiptId ? { receiptId } : {}) });
const rec = (id: string, status: string, kind: Receipt['kind'] = 'receipt'): Receipt => ({ id, path: `c/${id}.jpg`, kind, status, createdAt: `2026-10-23T10:0${id.slice(-1)}:00Z` });
const event = (receipts: Receipt[], items: Item[]): BarEvent => ({
  id: 'e', date: '2026-10-23', placeId: '', members: [], tips: 0, tipsMode: 'sum', currency: 'RUB', payer: '', settled: [], status: '', items, receipts,
});

describe('несколько чеков', () => {
  it('склонение', () => {
    expect(plural(1, 'чек', 'чека', 'чеков')).toBe('чек');
    expect(plural(3, 'чек', 'чека', 'чеков')).toBe('чека');
    expect(plural(11, 'чек', 'чека', 'чеков')).toBe('чеков');
    expect(plural(22, 'чек', 'чека', 'чеков')).toBe('чека');
  });

  it('подписи: один чек без номера, несколько — с номером', () => {
    const one = event([rec('r1', '✅')], []);
    expect(receiptLabel(one, one.receipts![0])).toBe('Чек');
    expect(receiptsTitle(one, false)).toBe('Чек');
    const two = event([rec('r1', '✅'), rec('r2', '✅', 'tickets')], []);
    expect(receiptLabel(two, two.receipts![1])).toBe('Билеты 2');
    expect(receiptsTitle(two, false)).toBe('2 чека');
    expect(receiptsTitle(two, true)).toBe('2 скриншота');
  });

  it('разделы позиций: по чекам и «Вручную» в конце', () => {
    const ev = event([rec('r1', '✅'), rec('r2', '✅')], [item('a', 100, 'r2'), item('b', 50), item('c', 30, 'r1'), item('d', 10, 'gone')]);
    const g = itemGroups(ev);
    expect(g.map((x) => x.title)).toEqual(['Чек 1', 'Чек 2', 'Вручную']);
    expect(g[2].items.map((i) => i.id)).toEqual(['b', 'd']);
  });

  it('старые встречи: позиции без чека — один раздел, значит без разделов', () => {
    const ev = event([rec('r1', '✅ Распознано позиций: 2, на 150')], [item('a', 100), item('b', 50)]);
    expect(itemGroups(ev)).toHaveLength(1);
    expect(receiptsSummary(ev).text).toBe('Распознано позиций: 2, на 150');
  });

  it('сводка: идёт распознавание и не сходится итог', () => {
    expect(receiptsSummary(event([rec('r1', '✅'), rec('r2', '⏳ Распознаю чек…')], [])).state).toBe('busy');
    const warn = receiptsSummary(event([rec('r1', '✅'), rec('r2', '⚠️ итог другой')], [item('a', 100, 'r1'), item('b', 50, 'r2')]));
    expect(warn.state).toBe('warn');
    expect(warn.text).toContain('2 поз.');
    expect(warn.text).toContain('чек 2: не сходится итог');
  });
});
