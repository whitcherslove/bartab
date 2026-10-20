import type { BarEvent, Item, State } from './types';
import { supabase } from './supabase';
import { RECEIPT_FN, TELEGRAM_FN } from './functions';
import { stats } from './calc';

// ---------- Загрузка всех данных компании ----------

type PersonRow = { id: string; name: string; tg: string; user_id: string | null; avatar_url: string; archived: boolean };
type PlaceRow = { id: string; name: string; address: string; hue: number; photo_path: string; map_url: string; lat: number | null; lon: number | null; category: 'bar' | 'shop' | 'cinema' };
type ShareRow = { person_id: string; qty: number };
type ItemRow = { id: string; name: string; price: number | string; qty: number; split_mode: 'equal' | 'qty'; created_at: string; item_shares: ShareRow[] };
type EventRow = {
  id: string; place_id: string | null; date: string; tips: number | string; tips_mode: 'sum' | 'pct'; currency: string;
  payer_id: string | null; status: string; receipt_path: string; event_members: { person_id: string; settled: boolean }[]; items: ItemRow[];
};
type ChatRow = { id: string; name: string; chat_id: string };

const EVENT_SELECT = 'id, place_id, date, tips, tips_mode, currency, payer_id, status, receipt_path, event_members(person_id, settled), items(id, name, price, qty, split_mode, created_at, item_shares(person_id, qty))';

function mapEvent(e: EventRow, byPeopleOrder: (a: string, b: string) => number = () => 0): BarEvent {
  return {
    id: e.id,
    date: e.date,
    placeId: e.place_id ?? '',
    tips: Number(e.tips) || 0,
    tipsMode: e.tips_mode,
    currency: e.currency || 'RUB',
    payer: e.payer_id ?? '',
    status: e.status,
    receiptPath: e.receipt_path ?? '',
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
  };
}

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function fetchCrew(crewId: string, userId: string): Promise<State> {
  const [peopleRes, placesRes, eventsRes, chatsRes] = await Promise.all([
    supabase.from('people').select('id, name, tg, user_id, avatar_url, archived').eq('crew_id', crewId).order('created_at'),
    // бары всех моих компаний и встреч — правила доступа в базе решают, что видно
    supabase.from('places').select('id, name, address, hue, photo_path, map_url, lat, lon, category').order('created_at'),
    supabase
      .from('events')
      .select(EVENT_SELECT)
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
    people: people.map((p) => ({ id: p.id, name: p.name, tg: p.tg, userId: p.user_id, avatar: p.avatar_url ?? '', archived: !!p.archived })),
    places: places.map((p) => ({ id: p.id, name: p.name, address: p.address, hue: p.hue, photo: p.photo_path, mapUrl: p.map_url ?? '', lat: p.lat, lon: p.lon, category: p.category ?? 'bar' })),
    chats: chats.map((c) => ({ id: c.id, name: c.name, chatId: c.chat_id })),
    events: events.map((e) => mapEvent(e, byPeopleOrder)),
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
  const placeRow = (p: State['places'][number]) => ({ name: p.name, address: p.address, hue: p.hue, photo_path: p.photo, map_url: p.mapUrl, lat: p.lat, lon: p.lon, category: p.category || 'bar' });
  const newPlaces = next.places.filter((p) => !prevPlaces.has(p.id));
  if (newPlaces.length) await run(supabase.from('places').insert(newPlaces.map((p) => ({ id: p.id, crew_id: crewId, ...placeRow(p) }))));
  for (const p of next.places) {
    const o = prevPlaces.get(p.id);
    if (o && !same(o, p)) await run(supabase.from('places').update(placeRow(p)).eq('id', p.id));
  }

  // 2. Встречи
  const prevEvents = byId(prev.events);
  const evRow = (e: BarEvent) => ({
    id: e.id, crew_id: crewId, place_id: e.placeId || null, date: e.date, tips: e.tips,
    tips_mode: e.tipsMode, currency: e.currency || 'RUB', payer_id: e.payer || null, status: e.status,
  });
  const events = next.events.filter((e) => {
    const o = prevEvents.get(e.id);
    return !o || !same(evRow(o), evRow(e));
  });
  if (events.length) await run(supabase.from('events').upsert(events.map(evRow)));

  // 3. Участники встреч и позиции
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

/** Квадратная картинка 256 px из фото (по центру) */
function squareJpeg(file: File): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
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
}

async function uploadTo(bucket: string, path: string, blob: Blob) {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Аватарка пользователя: в его папку в хранилище avatars */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  return uploadTo('avatars', `${userId}/${Date.now()}.jpg`, await squareJpeg(file));
}

/** Аватарка компании: в папку компании в хранилище place-photos и сразу в карточку компании */
export async function setCrewAvatar(crewId: string, file: File | null): Promise<void> {
  const url = file ? await uploadTo('place-photos', `${crewId}/crew-${Date.now()}.jpg`, await squareJpeg(file)) : '';
  const { error } = await supabase.from('crews').update({ avatar_url: url }).eq('id', crewId);
  if (error) throw error;
}

/** Удалить человека из компании: 'deleted' — полностью, 'archived' — скрыт, история осталась */
export async function removePerson(personId: string): Promise<'deleted' | 'archived'> {
  const { data, error } = await supabase.rpc('remove_person', { p: personId });
  if (error) throw error;
  return data as 'deleted' | 'archived';
}

// ---------- История встреч по всем компаниям (для профиля) ----------

export type Visit = {
  eventId: string;
  date: string;
  crewId: string;
  place: { id: string; name: string; address: string; hue: number; photo: string; category: 'bar' | 'shop' | 'cinema' } | null;
  /** участники встречи — для аватарок в истории */
  people: { id: string; name: string; avatar: string; userId: string | null }[];
};

type VisitRow = {
  events: {
    id: string; date: string; crew_id: string;
    places: { id: string; name: string; address: string; hue: number; photo_path: string; category: 'bar' | 'shop' | 'cinema' } | null;
    event_members: { people: { id: string; name: string; avatar_url: string; user_id: string | null } | null }[];
  } | null;
};

/** Все встречи, где я участник, во всех моих компаниях */
export async function fetchMyVisits(userId: string): Promise<Visit[]> {
  const { data: me, error: e1 } = await supabase.from('people').select('id').eq('user_id', userId);
  if (e1) throw e1;
  const ids = (me ?? []).map((p: { id: string }) => p.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('event_members')
    .select('events(id, date, crew_id, places(id, name, address, hue, photo_path, category), event_members(people(id, name, avatar_url, user_id)))')
    .in('person_id', ids);
  if (error) throw error;
  return ((data ?? []) as unknown as VisitRow[])
    .map((r) => r.events)
    .filter((e): e is NonNullable<VisitRow['events']> => !!e)
    .map((e) => ({
      eventId: e.id,
      date: e.date,
      crewId: e.crew_id,
      place: e.places ? { id: e.places.id, name: e.places.name, address: e.places.address, hue: e.places.hue, photo: e.places.photo_path, category: e.places.category ?? 'bar' } : null,
      people: (e.event_members ?? []).map((m) => m.people).filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar_url ?? '', userId: p.user_id })),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Временная ссылка на фото чека (хранилище закрытое) */
export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------- Долги по всем компаниям (для профиля) ----------

export type OpenDebt = {
  eventId: string;
  crewId: string;
  date: string;
  placeName: string;
  placeCategory: string;
  currency: string;
  amount: number;
  /** для «Ждёшь»: кто сколько должен; для «От тебя ждут»: кому переводить */
  people: { name: string; amount: number }[];
};

export async function fetchMyDebts(userId: string): Promise<{ waiting: OpenDebt[]; owing: OpenDebt[] }> {
  const { data: me, error: e1 } = await supabase.from('people').select('id, crew_id').eq('user_id', userId);
  if (e1) throw e1;
  const mine = (me ?? []) as { id: string; crew_id: string }[];
  if (!mine.length) return { waiting: [], owing: [] };
  const myByCrew = new Map(mine.map((p) => [p.crew_id, p.id]));

  const { data: em, error: e2 } = await supabase.from('event_members').select('event_id').in('person_id', mine.map((p) => p.id));
  if (e2) throw e2;
  const eventIds = [...new Set(((em ?? []) as { event_id: string }[]).map((r) => r.event_id))];
  if (!eventIds.length) return { waiting: [], owing: [] };

  const [evRes, peopleRes] = await Promise.all([
    supabase.from('events').select(EVENT_SELECT + ', crew_id, places(name, category)').in('id', eventIds),
    supabase.from('people').select('id, name').in('crew_id', [...myByCrew.keys()]),
  ]);
  const rows = must(evRes) as unknown as (EventRow & { crew_id: string; places: { name: string; category: string } | null })[];
  const names = new Map(((must(peopleRes) ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const nameOf = (id: string) => names.get(id) ?? '?';

  const waiting: OpenDebt[] = [], owing: OpenDebt[] = [];
  for (const r of rows) {
    const ev = mapEvent(r);
    const meId = myByCrew.get(r.crew_id);
    if (!meId || !ev.payer) continue;
    const st = stats(ev, meId);
    const base = { eventId: ev.id, crewId: r.crew_id, date: ev.date, placeName: r.places?.name ?? 'Без места', placeCategory: r.places?.category ?? 'bar', currency: ev.currency };
    if (st.isPayer && st.balance > 1) {
      const people = ev.members
        .filter((m) => m !== meId && !ev.settled.includes(m))
        .map((m) => ({ name: nameOf(m), amount: stats(ev, m).owed }))
        .filter((p) => p.amount >= 1);
      waiting.push({ ...base, amount: st.balance, people });
    } else if (!st.isPayer && !st.settled && st.owed >= 1) {
      owing.push({ ...base, amount: st.owed, people: [{ name: nameOf(ev.payer), amount: st.owed }] });
    }
  }
  const byDate = (a: OpenDebt, b: OpenDebt) => b.date.localeCompare(a.date);
  return { waiting: waiting.sort(byDate), owing: owing.sort(byDate) };
}
