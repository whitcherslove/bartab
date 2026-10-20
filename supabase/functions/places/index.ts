// BarTab — поиск заведений.
// POST { q, lat?, lon? } → { provider, results: [{ name, address, kind, mapUrl, lat, lon }] }
//
// Логика: в России — Яндекс Геосаджест; за её пределами — HERE (если задан ключ),
// иначе OpenStreetMap (Photon). Если ничего не нашлось — бар добавляют вручную.
//
// Секреты (Edge Functions → Secrets):
//   YANDEX_SUGGEST_KEY — ключ API Геосаджеста (для России)
//   HERE_API_KEY       — необязательно: ключ HERE для поиска за границей
//   SITE_URL           — необязательно: адрес сайта для Яндекса (по умолчанию https://bartab-rose.vercel.app/)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Found = { name: string; address: string; kind: string; mapUrl: string; lat: number | null; lon: number | null };
type Near = { lat: number; lon: number } | null;

// ---------- Яндекс ----------

type YComponent = { name: string; kind: string[] };
type YItem = { title?: { text: string }; subtitle?: { text: string }; address?: { formatted_address?: string; component?: YComponent[] }; uri?: string };

function yShortAddress(a?: YItem['address']) {
  const comps = a?.component ?? [];
  const pick = (k: string) => comps.find((c) => c.kind.some((x) => x.toUpperCase() === k))?.name;
  const street = pick('STREET');
  // улица из компонентов — «Вознесенский проспект, 13, Санкт-Петербург», иначе готовый адрес без страны
  if (street) return [[street, pick('HOUSE')].filter(Boolean).join(', '), pick('LOCALITY')].filter(Boolean).join(', ');
  return (a?.formatted_address ?? '').replace(/^(Россия|Russia),\s*/, '');
}
/** Страна — только если Яндекс указал её явно отдельным полем */
const yCountry = (a?: YItem['address']) =>
  a?.component?.find((c) => c.kind.some((k) => k.toUpperCase() === 'COUNTRY'))?.name ?? '';
const yOrgLink = (uri?: string) => {
  const oid = uri?.match(/[?&]oid=(\d+)/)?.[1];
  return oid ? `https://yandex.ru/maps/org/${oid}/` : '';
};

/** Заведения в России по версии Яндекса (пусто — если ты не в России или ничего не нашлось) */
async function searchYandex(q: string, near: Near): Promise<Found[]> {
  const key = Deno.env.get('YANDEX_SUGGEST_KEY');
  if (!key) return [];
  const params = new URLSearchParams({ apikey: key.trim(), text: q, types: 'biz', results: '8', lang: 'ru', print_address: '1', attrs: 'uri', highlight: '0' });
  if (near) {
    params.set('ll', `${near.lon},${near.lat}`);
    params.set('spn', '0.5,0.5');
    params.set('ull', `${near.lon},${near.lat}`);
  }
  const site = Deno.env.get('SITE_URL') || 'https://bartab-rose.vercel.app/';
  const resp = await fetch(`https://suggest-maps.yandex.ru/v1/suggest?${params}`, {
    headers: { Referer: site, Origin: new URL(site).origin, 'User-Agent': 'BarTab/1.0' },
  });
  if (!resp.ok) {
    const body = (await resp.text()).slice(0, 300) || '(пустой ответ)';
    const k = key.trim();
    console.error(`Яндекс ${resp.status}: ${body} | ключ: ${k.length} символов, начало ${k.slice(0, 4)}…, пробелы по краям: ${k !== key ? 'ДА' : 'нет'}`);
    return [];
  }
  const data = (await resp.json()) as { results?: YItem[] };
  const raw = data.results ?? [];
  // отбрасываем только заведения, где явно указана другая страна
  const kept = raw.filter((r) => {
    const country = yCountry(r.address);
    return r.title?.text && (!country || /^(Россия|Russia)$/i.test(country));
  });
  console.log(`Яндекс: «${q}» — найдено ${raw.length}, в России ${kept.length}`);
  return kept
    .map((r) => {
      const address = yShortAddress(r.address);
      const sub = r.subtitle?.text ?? '';
      return { name: r.title!.text, address, kind: sub && !address.includes(sub) ? sub.split(' · ')[0] : '', mapUrl: yOrgLink(r.uri), lat: null, lon: null };
    });
}

// ---------- HERE ----------

type HItem = { title?: string; resultType?: string; address?: { label?: string; street?: string; houseNumber?: string; city?: string }; position?: { lat: number; lng: number }; categories?: { name: string }[] };

async function searchHere(q: string, near: Near): Promise<Found[]> {
  const key = Deno.env.get('HERE_API_KEY');
  if (!key || !near) return [];
  const params = new URLSearchParams({ q, at: `${near.lat},${near.lon}`, limit: '8', lang: 'ru', apiKey: key });
  const resp = await fetch(`https://discover.search.hereapi.com/v1/discover?${params}`);
  if (!resp.ok) {
    console.error('HERE', resp.status, (await resp.text()).slice(0, 200));
    return [];
  }
  const data = (await resp.json()) as { items?: HItem[] };
  return (data.items ?? [])
    .filter((i) => i.title && i.resultType === 'place')
    .map((i) => {
      const a = i.address ?? {};
      const street = [a.street, a.houseNumber].filter(Boolean).join(', ');
      return {
        name: i.title!,
        address: [street, a.city].filter(Boolean).join(', ') || a.label || '',
        kind: i.categories?.[0]?.name ?? '',
        mapUrl: '',
        lat: i.position?.lat ?? null,
        lon: i.position?.lng ?? null,
      };
    });
}

// ---------- OpenStreetMap (Photon) ----------

const OSM_KINDS: Record<string, string> = { bar: 'бар', pub: 'паб', biergarten: 'пивной сад', nightclub: 'клуб', restaurant: 'ресторан', cafe: 'кафе', fast_food: 'еда', cinema: 'кинотеатр' };
type PFeature = { geometry: { coordinates: [number, number] }; properties: { name?: string; osm_key?: string; osm_value?: string; street?: string; housenumber?: string; city?: string; locality?: string; district?: string } };

async function searchOsm(q: string, near: Near): Promise<Found[]> {
  const params = new URLSearchParams({ q, limit: '20' });
  if (near) { params.set('lat', String(near.lat)); params.set('lon', String(near.lon)); }
  const resp = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: { 'User-Agent': 'BarTab/1.0' } });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { features?: PFeature[] };
  const all = (data.features ?? []).filter((f) => f.properties.name).map((f) => {
    const p = f.properties;
    return {
      name: p.name!,
      address: [[p.street, p.housenumber].filter(Boolean).join(', '), p.city || p.locality || p.district].filter(Boolean).join(', '),
      kind: p.osm_key === 'amenity' ? OSM_KINDS[p.osm_value ?? ''] ?? '' : p.osm_key === 'shop' ? 'магазин' : '',
      mapUrl: '',
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
    };
  });
  const venues = all.filter((p) => p.kind);
  return (venues.length ? venues : all).slice(0, 8);
}

// ---------- Точка входа ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!req.headers.get('Authorization')) return json({ error: 'Нужно войти в приложение' }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body.q ?? '').trim().slice(0, 100);
    if (q.length < 2) return json({ provider: '', results: [] });
    const lat = Number(body.lat), lon = Number(body.lon);
    const near: Near = Number.isFinite(lat) && Number.isFinite(lon) && body.lat != null && body.lon != null ? { lat, lon } : null;

    const yandex = await searchYandex(q, near).catch((e) => { console.error('Яндекс:', e); return [] as Found[]; });
    if (yandex.length) return json({ provider: 'Яндекс', results: yandex });

    const here = await searchHere(q, near).catch((e) => { console.error('HERE:', e); return [] as Found[]; });
    if (here.length) return json({ provider: 'HERE', results: here });

    const osm = await searchOsm(q, near).catch((e) => { console.error('OSM:', e); return [] as Found[]; });
    return json({ provider: osm.length ? 'OpenStreetMap' : '', results: osm });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('places:', msg);
    return json({ error: msg }, 500);
  }
});
