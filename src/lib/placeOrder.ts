// Личный порядок мест: у каждого свой, хранится в профиле (profiles.place_order)

/** Места в личном порядке; новые (ещё не расставленные) — в конце, как добавлены */
export function sortPlaces<T extends { id: string }>(list: T[], order: string[]): T[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  return list
    .map((p, i) => ({ p, k: pos.get(p.id) ?? order.length + i }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);
}

/**
 * Новый общий порядок, когда переставили места одной категории:
 * её места встают на свои же «слоты» в новом порядке, остальные не двигаются.
 */
export function mergeOrder(allSorted: string[], reordered: string[]): string[] {
  const set = new Set(reordered);
  let k = 0;
  return allSorted.map((id) => (set.has(id) ? reordered[k++] : id));
}

/** Переставить элемент массива */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
