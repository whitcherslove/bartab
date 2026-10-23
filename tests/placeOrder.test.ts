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
