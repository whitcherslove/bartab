import type { BarEvent, Item, State } from './types';
import { supabase } from './supabase';
import { RECEIPT_FN, TELEGRAM_FN } from './functions';

// ---------- Загрузка всех данных компании ----------

type PersonRow = { id: string; name: string; tg: string; user_id: string | null; avatar_url: string };
type PlaceRow = { id: string; name: string; address: string; hue: number; photo_path: string; map_url: string; lat: number | null; lon: number | null };
type ShareRow = { person_id: string; qty: number };
type ItemRow = { id: string; name: string; price: number | string; qty: number; split_mode: 'equal' | 'qty'; created_at: string; item_shares: ShareRow[] };
type EventRow = {
  id: string; place_id: string | null; date: string; tips: number | string; tips_mode: 'sum' | 'pct';
  payer_id: string | null; status: string; event_members: { person_id: string; settled: boolean }[]; items: ItemRow[];
};
type ChatRow = { id: string; name: string; chat_id: string };

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function fetchCrew(crewId: string, userId: string): Promise<State> {
  const [peopleRes, placesRes, eventsRes, chatsRes] = await Promise.all([
    supabase.from('people').select('id, name, tg, user_id, avatar_url').eq('crew_id', crewId).order('created_at'),
    // бары всех моих компаний и посиделок — правила доступа в базе решают, что видно
    supabase.from('places').select('id, name, address, hue, photo_path, map_url, lat, lon').order('created_at'),
    supabase
      .from('events')
      .select('id, place_id, date, tips, tips_mode, payer_id, status, event_members(person_id, settled), items(id, name, price, qty, split_mode, created_at, item_shares(person_id, qty))')
      .eq('crew_id', crewId)
      .order('date', { ascending: false }),
    supabase.from('tg_chats').select('id, name, chat_id').order('created_at'),
  ]);

  const people = must(peopleRes) as PersonRow[];
  const places = must(placesRes) as PlaceRow[];
  const events = must(eventsRes) as EventRow[];
  const chats = must(chatsRes) as ChatRow[];
  const order = new Map(people.map((p, i) => [p.id, i]));
  const byPeopleOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);

  return {
    me: people.find((p) => p.user_id === userId)?.id ?? '',
    people: people.map((p) => ({ id: p.id, name: p.name, tg: p.tg, userId: p.user_id, avatar: p.avatar_url ?? '' })),
    places: places.map((p) => ({ id: p.id, name: p.name, address: p.address, hue: p.hue, photo: p.photo_path, mapUrl: p.map_url ?? '', lat: p.lat, lon: p.lon })),
    chats: chats.map((c) => ({ id: c.id, name: c.name, chatId: c.chat_id })),
    events: events.map((e): BarEvent => ({
      id: e.id,
      date: e.date,
      placeId: e.place_id ?? '',
      tips: Number(e.tips) || 0,
      tipsMode: e.tips_mode,
      payer: e.payer_id ?? '',
      status: e.status,
      members: e.event_members.map((m) => m.person_id).sort(byPeopleOrder),
      settled: e.event_members.filter((m) => m.settled).map((m) => m.person_id),
      items: [...e.items]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((it): Item => ({
          id: it.id,
          name: it.name,
          price: Number(it.price) || 0,
          qty: it.qty,
          splitMode: it.split_mode,
          consumers: it.item_shares.map((s) => s.person_id).sort(byPeopleOrder),
          split: it.split_mode === 'qty' ? Object.fromEntries(it.item_shares.map((s) => [s.person_id, s.qty])) : {},
        })),
    })),
  };
}

// ---------- Запись изменений: сравниваем «было» и «стало» ----------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

async function run(q: PromiseLike<{ error: unknown }>) {
  const { error } = await q;
  if (error) throw error;
}

function itemSig(it: Item) {
  return [it.name, it.price, it.qty, it.splitMode, [...it.consumers].sort(), it.splitMode === 'qty' ? it.split : {}];
}

/** Отправляет в базу только то, что изменилось между prev и next */
export async function pushDiff(prev: State, next: State, crewId: string) {
  // 1. Люди и бары
  const prevPeople = byId(prev.people);
  const people = next.people.filter((p) => {
    const o = prevPeople.get(p.id);
    return !o || o.name !== p.name || o.tg !== p.tg;
  });
  if (people.length) await run(supabase.from('people').upsert(people.map((p) => ({ id: p.id, crew_id: crewId, name: p.name, tg: p.tg }))));

  // Бары: новые создаём в текущей компании, существующие меняем, не трогая их компанию
  const prevPlaces = byId(prev.places);
  const placeRow = (p: State['places'][number]) => ({ name: p.name, address: p.address, hue: p.hue, photo_path: p.photo, map_url: p.mapUrl, lat: p.lat, lon: p.lon });
  const newPlaces = next.places.filter((p) => !prevPlaces.has(p.id));
  if (newPlaces.length) await run(supabase.from('places').insert(newPlaces.map((p) => ({ id: p.id, crew_id: crewId, ...placeRow(p) }))));
  for (const p of next.places) {
    const o = prevPlaces.get(p.id);
    if (o && !same(o, p)) await run(supabase.from('places').update(placeRow(p)).eq('id', p.id));
  }

  // 2. Посиделки
  const prevEvents = byId(prev.events);
  const evRow = (e: BarEvent) => ({
    id: e.id, crew_id: crewId, place_id: e.placeId || null, date: e.date, tips: e.tips,
    tips_mode: e.tipsMode, payer_id: e.payer || null, status: e.status,
  });
  const events = next.events.filter((e) => {
    const o = prevEvents.get(e.id);
    return !o || !same(evRow(o), evRow(e));
  });
  if (events.length) await run(supabase.from('events').upsert(events.map(evRow)));

  // 3. Участники посиделок и позиции
  const memberUpserts: { event_id: string; person_id: string; settled: boolean }[] = [];
  const memberDeletes: { event: string; people: string[] }[] = [];
  const itemUpserts: Item[] = [];
  const itemEvent = new Map<string, string>();
  const itemDeletes: string[] = [];

  for (const e of next.events) {
    const o = prevEvents.get(e.id);
    for (const m of e.members) {
      const settled = e.settled.includes(m);
      if (!o || !o.members.includes(m) || o.settled.includes(m) !== settled) memberUpserts.push({ event_id: e.id, person_id: m, settled });
    }
    if (o) {
      const removed = o.members.filter((m) => !e.members.includes(m));
      if (removed.length) memberDeletes.push({ event: e.id, people: removed });
    }
    const prevItems = byId(o?.items ?? []);
    for (const it of e.items) {
      const pi = prevItems.get(it.id);
      if (!pi || !same(itemSig(pi), itemSig(it))) {
        itemUpserts.push(it);
        itemEvent.set(it.id, e.id);
      }
    }
    if (o) itemDeletes.push(...o.items.filter((pi) => !e.items.some((it) => it.id === pi.id)).map((pi) => pi.id));
  }

  if (memberUpserts.length) await run(supabase.from('event_members').upsert(memberUpserts));
  if (itemUpserts.length) {
    await run(
      supabase.from('items').upsert(
        itemUpserts.map((it) => ({ id: it.id, event_id: itemEvent.get(it.id), name: it.name, price: it.price, qty: it.qty, split_mode: it.splitMode })),
      ),
    );
    // кто что пил: перезаписываем целиком для изменённых позиций
    const ids = itemUpserts.map((it) => it.id);
    await run(supabase.from('item_shares').delete().in('item_id', ids));
    const shares = itemUpserts.flatMap((it) =>
      it.splitMode === 'qty'
        ? Object.entries(it.split).filter(([, n]) => n > 0).map(([person_id, qty]) => ({ item_id: it.id, person_id, qty }))
        : it.consumers.map((person_id) => ({ item_id: it.id, person_id, qty: 1 })),
    );
    if (shares.length) await run(supabase.from('item_shares').insert(shares));
  }

  // 4. Удаления (вложенное база удалит сама)
  for (const d of memberDeletes) await run(supabase.from('event_members').delete().eq('event_id', d.event).in('person_id', d.people));
  if (itemDeletes.length) await run(supabase.from('items').delete().in('id', itemDeletes));
  const nextEventIds = new Set(next.events.map((e) => e.id));
  const evDeletes = prev.events.filter((e) => !nextEventIds.has(e.id)).map((e) => e.id);
  if (evDeletes.length) await run(supabase.from('events').delete().in('id', evDeletes));
  const nextPeople = new Set(next.people.map((p) => p.id));
  const pDeletes = prev.people.filter((p) => !nextPeople.has(p.id)).map((p) => p.id);
  if (pDeletes.length) await run(supabase.from('people').delete().in('id', pDeletes));
  const nextPlaces = new Set(next.places.map((p) => p.id));
  const plDeletes = prev.places.filter((p) => !nextPlaces.has(p.id)).map((p) => p.id);
  if (plDeletes.length) await run(supabase.from('places').delete().in('id', plDeletes));
}

/** Загрузка фото бара в хранилище; возвращает публичную ссылку */
export async function uploadPlacePhoto(crewId: string, placeId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${crewId}/${placeId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('place-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('place-photos').getPublicUrl(path).data.publicUrl;
}

/** Загрузка фото чека и запуск распознавания на сервере */
export async function recognizeReceipt(crewId: string, eventId: string, blob: Blob) {
  const path = `${crewId}/${eventId}-${Date.now()}.jpg`;
  const up = await supabase.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase.functions.invoke(RECEIPT_FN, { body: { eventId, path } });
  if (error) throw await functionError(error);
  return data as { count: number; sum: number; total: number; status: string };
}

/** Достаём понятный текст ошибки из ответа функции */
async function functionError(error: Error): Promise<Error> {
  const ctx = (error as { context?: Response }).context;
  let msg = error.message;
  try { if (ctx) msg = (await ctx.json()).error ?? msg; } catch { /* оставляем как есть */ }
  if (/Failed to send a request/i.test(msg)) msg = 'Функция недоступна: проверь её адрес в src/lib/functions.ts и что она задеплоена';
  return new Error(msg);
}

/** Telegram-бот: имя, подключение чата по коду, отправка итогов */
async function telegram<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(TELEGRAM_FN, { body });
  if (error) throw await functionError(error);
  return data as T;
}
export const tgBotName = () => telegram<{ username: string }>({ action: 'info' }).then((r) => r.username);
export const tgFindChat = (code: string, crewId: string) => telegram<{ found: boolean; name?: string }>({ action: 'find_chat', code, crewId });
export const tgSend = (crewId: string, text: string) => telegram<{ ok: boolean; name: string }>({ action: 'send', crewId, text });

/** Отключить Telegram-чат компании */
export async function disconnectCrewChat(crewId: string) {
  const { error } = await supabase.from('crews').update({ tg_chat_id: null, tg_chat_name: '', tg_chat_by: '' }).eq('id', crewId);
  if (error) throw error;
}

/** Аватарка: квадрат 256 px, в папку пользователя; возвращает публичную ссылку */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d')?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Не удалось открыть фото'));
    img.src = URL.createObjectURL(file);
  });
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
