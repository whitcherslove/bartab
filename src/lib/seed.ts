import type { State } from './types';

export function seed(): State {
  const all = ['d1', 'd2', 'd3', 'd4'];
  return {
    me: 'd1',
    people: [
      { id: 'd1', name: 'Я', tg: '' },
      { id: 'd2', name: 'Вася', tg: 'vasya_pub' },
      { id: 'd3', name: 'Петя', tg: 'petr_k' },
      { id: 'd4', name: 'Оля', tg: 'olya_hops' },
    ],
    places: [
      { id: 'p1', name: 'Хмель и Солод', address: 'ул. Пушкина, 10', hue: 28, photo: '' },
      { id: 'p2', name: 'Чёрный пёс', address: 'Набережная, 3', hue: 200, photo: '' },
    ],
    chats: [
      { id: 'c1', name: 'Пятничная группа' },
      { id: 'c2', name: 'Работа после работы' },
    ],
    events: [
      {
        id: 'e1', date: '2026-10-16', placeId: 'p1', members: all,
        tips: 10, tipsMode: 'pct', payer: 'd1', settled: ['d3'], status: '',
        items: [
          { id: 'i1', name: 'Пиво светлое 0,5', price: 350, qty: 6, splitMode: 'qty', consumers: all, split: { d1: 2, d2: 2, d3: 1, d4: 1 } },
          { id: 'i2', name: 'Негрони', price: 650, qty: 1, splitMode: 'equal', consumers: ['d4'], split: {} },
          { id: 'i3', name: 'Начос с сыром', price: 520, qty: 1, splitMode: 'equal', consumers: ['d1', 'd3'], split: {} },
          { id: 'i4', name: 'Сырная тарелка', price: 780, qty: 1, splitMode: 'equal', consumers: all, split: {} },
        ],
      },
      {
        id: 'e2', date: '2026-10-02', placeId: 'p2', members: ['d1', 'd2'],
        tips: 200, tipsMode: 'sum', payer: 'd2', settled: ['d1'], status: '',
        items: [
          { id: 'i5', name: 'Стаут', price: 420, qty: 4, splitMode: 'equal', consumers: ['d1', 'd2'], split: {} },
          { id: 'i6', name: 'Крылья BBQ', price: 690, qty: 1, splitMode: 'equal', consumers: ['d2'], split: {} },
        ],
      },
    ],
  };
}
