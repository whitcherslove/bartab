// Категории мест. Список фиксированный, бары всегда первые и по умолчанию.

export type Category = 'bar' | 'shop' | 'cinema';

export const CATEGORIES: { id: Category; many: string; one: string; emoji: string; match: RegExp }[] = [
  { id: 'bar', many: 'Бары', one: 'Бар', emoji: '🍺', match: /бар|паб|пивн|коктейл|рюмочн|ресторан|кафе|кальян|pub|bar|biergarten|nightclub|клуб/i },
  { id: 'shop', many: 'Магазины', one: 'Магазин', emoji: '🛍', match: /магазин|супермаркет|гипермаркет|маркет|торгов|универсам|продукт|shop|supermarket|mall/i },
  { id: 'cinema', many: 'Кинотеатры', one: 'Кинотеатр', emoji: '🎬', match: /кино|cinema/i },
];

export const DEFAULT_CATEGORY: Category = 'bar';
export const catOf = (id?: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
