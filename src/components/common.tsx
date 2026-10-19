import type { CSSProperties, ReactNode } from 'react';
import type { Place } from '../lib/types';
import { hueOf, money } from '../lib/format';
import { useStore } from '../lib/store';

export function Av({ id, sm }: { id: string; sm?: boolean }) {
  const { nameOf } = useStore();
  const name = nameOf(id);
  return (
    <span className={'av' + (sm ? ' sm' : '')} style={{ background: `hsl(${hueOf(name + id)} 45% 42%)` }} title={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Pill({ b }: { b: number }) {
  if (Math.abs(b) < 1) return <span className="pill zero">в расчёте</span>;
  return b > 0 ? <span className="pill pos num">+{money(b)}</span> : <span className="pill neg num">−{money(-b)}</span>;
}

export function photoStyle(place?: Pick<Place, 'name' | 'hue' | 'photo'>): CSSProperties {
  if (place?.photo) return { backgroundImage: `url(${place.photo})` };
  const h = place?.hue ?? hueOf(place?.name ?? '?');
  return {
    background: `radial-gradient(circle at 20% 20%, hsl(${h} 70% 62%), transparent 60%), linear-gradient(135deg, hsl(${h} 55% 34%), hsl(${(h + 40) % 360} 45% 18%))`,
  };
}

export function PlacePhoto({ place, className = '', children }: { place?: Place; className?: string; children?: ReactNode }) {
  return (
    <div className={'photo ' + className} style={photoStyle(place)}>
      {!place?.photo && <span className="ph-letter">{(place?.name ?? '?').slice(0, 1)}</span>}
      {children}
    </div>
  );
}

export function PeopleChips({ ids, selected, onToggle }: { ids: string[]; selected: string[]; onToggle: (id: string) => void }) {
  const { nameOf } = useStore();
  return (
    <div className="chips">
      {ids.map((id) => (
        <button key={id} type="button" className="chip" aria-pressed={selected.includes(id)} onClick={() => onToggle(id)}>
          <Av id={id} sm />
          {nameOf(id)}
        </button>
      ))}
    </div>
  );
}
