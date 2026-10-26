import { describe, expect, it } from 'vitest';
import { mergeOrder, moveItem, sortPlaces } from '../src/lib/placeOrder';

const P = (...ids: string[]) => ids.map((id) => ({ id }));

describe('личный порядок мест', () => {
  it('без порядка — как есть', () => {
    expect(sortPlaces(P('a', 'b', 'c'), []).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
  it('по сохранённому порядку, новые — в конце', () => {
    expect(sortPlaces(P('a', 'b', 'c', 'new'), ['c', 'a', 'b']).map((p) => p.id)).toEqual(['c', 'a', 'b', 'new']);
  });
  it('удалённые места в порядке не мешают', () => {
    expect(sortPlaces(P('a', 'b'), ['gone', 'b', 'a']).map((p) => p.id)).toEqual(['b', 'a']);
  });
  it('переставили бары — кино остаётся на своих местах', () => {
    // все: бар1, кино1, бар2, бар3; бары переставили в бар3, бар1, бар2
    expect(mergeOrder(['b1', 'k1', 'b2', 'b3'], ['b3', 'b1', 'b2'])).toEqual(['b3', 'k1', 'b1', 'b2']);
  });
  it('перетаскивание', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
});

import { sortEvents, withForeign } from '../src/lib/placeOrder';

describe('порядок встреч', () => {
  const E = (id: string, date: string, createdAt?: string) => ({ id, date, createdAt });
  it('по умолчанию — последние созданные сверху, даже если дата встречи раньше', () => {
    const list = [E('old', '2026-10-20', '2026-10-01T10:00:00Z'), E('new', '2026-09-01', '2026-10-22T10:00:00Z')];
    expect(sortEvents(list, []).map((e) => e.id)).toEqual(['new', 'old']);
  });
  it('без времени создания (старые встречи) — по дате встречи', () => {
    expect(sortEvents([E('a', '2026-01-01'), E('b', '2026-05-01')], []).map((e) => e.id)).toEqual(['b', 'a']);
  });
  it('личный порядок, а новые — всё равно сверху', () => {
    const list = [E('a', '2026-01-01'), E('b', '2026-02-01'), E('c', '2026-03-01'), E('fresh', '2026-01-05', '2026-10-23T00:00:00Z')];
    expect(sortEvents(list, ['a', 'c', 'b']).map((e) => e.id)).toEqual(['fresh', 'a', 'c', 'b']);
  });
  it('порядок другой компании не теряется', () => {
    expect(withForeign(['b', 'a'], ['a', 'b'], ['x', 'a', 'y', 'b'])).toEqual(['b', 'a', 'x', 'y']);
  });
});
