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

/**
 * Сохранить порядок одной компании, не потеряв порядок других:
 * id из других компаний (их нет в списке на экране) остаются в конце как были.
 */
export function withForeign(newIds: string[], visibleIds: string[], saved: string[]): string[] {
  const visible = new Set(visibleIds);
  return [...newIds, ...saved.filter((id) => !visible.has(id))];
}

/**
 * Встречи: новые (ещё не расставленные) — всегда сверху, свежесозданные первыми;
 * дальше — в личном порядке. Без порядка — просто «последние созданные сверху».
 */
export function sortEvents<T extends { id: string; date: string; createdAt?: string }>(list: T[], order: string[]): T[] {
  const pos = new Map(order.map((id, i) => [id, i]));
  const fresh = list
    .filter((e) => !pos.has(e.id))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.date.localeCompare(a.date));
  const placed = list.filter((e) => pos.has(e.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return [...fresh, ...placed];
}
