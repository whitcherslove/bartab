import type { Place } from '../lib/types';
import { googleLink, yandexLink } from '../lib/maps';
import { Icon } from './Icons';

export function MapButtons({ place, compact }: { place: Place; compact?: boolean }) {
  return (
    <div className={'map-btns' + (compact ? ' compact' : '')}>
      <a className="btn sm" href={yandexLink(place)} target="_blank" rel="noopener">{Icon.pin} Яндекс Карты</a>
      <a className="btn sm" href={googleLink(place)} target="_blank" rel="noopener">{Icon.pin} Google Maps</a>
    </div>
  );
}
