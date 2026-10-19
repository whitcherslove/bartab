import type { Place } from './types';
import { supabase } from './supabase';
import { PLACES_FN } from './functions';

// ---------- Ссылки на карты ----------

const enc = encodeURIComponent;
const query = (p: Pick<Place, 'name' | 'address'>) => [p.name, p.address].filter(Boolean).join(', ');

/** Яндекс Карты: поиск заведения рядом с точкой (на телефоне откроет приложение) */
export function yandexLink(p: Pick<Place, 'name' | 'address' | 'lat' | 'lon' | 'mapUrl'>) {
  if (/yandex\.|ya\.ru/i.test(p.mapUrl)) return p.mapUrl;
  const near = p.lat != null && p.lon != null ? `&ll=${p.lon},${p.lat}&z=17` : '';
  return `https://yandex.ru/maps/?text=${enc(query(p))}${near}`;
}

/** Google Maps: поиск по названию и адресу (или по точке) */
export function googleLink(p: Pick<Place, 'name' | 'address' | 'lat' | 'lon' | 'mapUrl'>) {
  if (/google\.|goo\.gl/i.test(p.mapUrl)) return p.mapUrl;
  const q = p.address ? query(p) : p.lat != null && p.lon != null ? `${p.lat},${p.lon}` : p.name;
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

/** Похоже ли на ссылку из карт */
export const isMapUrl = (s: string) => /^https?:\/\/\S*(yandex\.|ya\.ru|google\.|goo\.gl|2gis\.|osm\.org|openstreetmap\.)/i.test(s.trim());

// ---------- Поиск баров: Яндекс (через нашу функцию), запасной — OpenStreetMap ----------

export type FoundPlace = { key: string; name: string; address: string; kind: string; lat: number | null; lon: number | null; mapUrl: string };

const KINDS: Record<string, string> = {
  bar: 'бар', pub: 'паб', biergarten: 'пивной сад', nightclub: 'клуб', restaurant: 'ресторан', cafe: 'кафе', fast_food: 'еда',
};

let myPos: { lat: number; lon: number } | null | undefined;

/** Где я — чтобы искать рядом. Спрашиваем один раз за сеанс. */
export function locate(): Promise<{ lat: number; lon: number } | null> {
  if (myPos !== undefined) return Promise.resolve(myPos);
  return new Promise((resolve) => {
    if (!navigator.geolocation) { myPos = null; return resolve(null); }
    navigator.geolocation.getCurrentPosition(
      (p) => { myPos = { lat: p.coords.latitude, lon: p.coords.longitude }; resolve(myPos); },
      () => { myPos = null; resolve(null); },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { osm_id?: number; osm_key?: string; osm_value?: string; name?: string; street?: string; housenumber?: string; city?: string; district?: string; locality?: string };
};

export type SearchResult = { provider: string; results: FoundPlace[] };

/** Поиск через нашу функцию (Россия — Яндекс, за границей — HERE или OpenStreetMap).
 *  Если функция недоступна — ищем в OpenStreetMap прямо с телефона. */
export async function searchPlaces(q: string, near: { lat: number; lon: number } | null, signal?: AbortSignal): Promise<SearchResult> {
  try {
    const { data, error } = await supabase.functions.invoke(PLACES_FN, { body: { q, lat: near?.lat, lon: near?.lon } });
    if (error) throw error;
    const d = data as { provider: string; results: Omit<FoundPlace, 'key'>[] };
    return { provider: d.provider, results: (d.results ?? []).map((r, i) => ({ key: `${i}-${r.mapUrl || r.name}-${r.lat ?? ''}`, ...r })) };
  } catch (e) {
    console.warn('Функция поиска недоступна, ищу в OpenStreetMap:', e);
    const results = await searchPhoton(q, near, signal);
    return { provider: results.length ? 'OpenStreetMap' : '', results };
  }
}

async function searchPhoton(q: string, near: { lat: number; lon: number } | null, signal?: AbortSignal): Promise<FoundPlace[]> {
  const params = new URLSearchParams({ q, limit: '20' });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lon));
  }
  const resp = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!resp.ok) throw new Error('Поиск сейчас недоступен');
  const data = (await resp.json()) as { features: PhotonFeature[] };

  const all = data.features
    .filter((f) => f.properties.name)
    .map((f): FoundPlace => {
      const pr = f.properties;
      const street = [pr.street, pr.housenumber].filter(Boolean).join(', ');
      return {
        key: `${pr.osm_id ?? ''}-${f.geometry.coordinates.join(',')}`,
        name: pr.name!,
        address: [street, pr.city || pr.locality || pr.district].filter(Boolean).join(', '),
        kind: pr.osm_key === 'amenity' ? KINDS[pr.osm_value ?? ''] ?? '' : '',
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        mapUrl: '',
      };
    });
  // заведения — наверх, остальное (улицы, города) — только если заведений нет
  const venues = all.filter((p) => p.kind);
  return (venues.length ? venues : all).slice(0, 8);
}
