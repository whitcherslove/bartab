import type { Place } from '../lib/types';
import { googleLink, yandexLink } from '../lib/maps';
import { Icon } from './Icons';

/** Откуда место: из Яндекса, из OpenStreetMap (есть точка) или добавлено вручную */
// eslint-disable-next-line react-refresh/only-export-components
export function mapSource(place: Pick<Place, 'lat' | 'lon' | 'mapUrl'>): 'yandex' | 'osm' | null {
  if (/yandex\.|ya\.ru/i.test(place.mapUrl || '')) return 'yandex';
  if (place.lat != null && place.lon != null) return 'osm';
  return null;
}

/** Кнопка карт по происхождению места; добавленное вручную — без кнопок */
export function MapButtons({ place, compact }: { place: Pick<Place, 'name' | 'address' | 'lat' | 'lon' | 'mapUrl'>; compact?: boolean }) {
  const src = mapSource(place);
  if (!src) return null;
  return (
    <div className={'map-btns' + (compact ? ' compact' : '')}>
      {src === 'yandex' && <a className="btn sm" href={yandexLink(place)} target="_blank" rel="noopener">{Icon.pin} Яндекс Карты</a>}
      {src === 'osm' && <a className="btn sm" href={googleLink(place)} target="_blank" rel="noopener">{Icon.pin} Google Maps</a>}
    </div>
  );
}
