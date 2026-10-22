// Категории мест. Список фиксированный, бары всегда первые и по умолчанию.

export type Category = 'bar' | 'cinema' | 'other';

export const CATEGORIES: { id: Category; many: string; one: string; emoji: string; match: RegExp }[] = [
  { id: 'bar', many: 'Бары', one: 'Бар', emoji: '🍺', match: /бар|паб|пивн|коктейл|рюмочн|кальян|pub|bar|biergarten|nightclub|клуб/i },
  { id: 'cinema', many: 'Кинотеатры', one: 'Кинотеатр', emoji: '🎬', match: /кино|cinema/i },
  // всё остальное: доставка, рестораны, кафе, магазины
  { id: 'other', many: 'Другое', one: 'Другое', emoji: '🧾', match: /ресторан|кафе|доставк|пицц|суши|бургер|столов|магазин|супермаркет|маркет|торгов|restaurant|cafe|shop|supermarket|mall/i },
];

export const DEFAULT_CATEGORY: Category = 'bar';
export const catOf = (id?: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

/** Категория встречи: по месту, а если места нет — своя */
export function eventCategory(ev: { placeId: string; category?: string } | undefined, places: { id: string; category?: string }[]): Category {
  const fromPlace = ev && places.find((p) => p.id === ev.placeId)?.category;
  const c = fromPlace || ev?.category;
  return (CATEGORIES.some((x) => x.id === c) ? c : DEFAULT_CATEGORY) as Category;
}
