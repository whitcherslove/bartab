import type { CSSProperties, ReactNode } from 'react';
import type { Place } from '../lib/types';
import { hueOf, money } from '../lib/format';
import { useStore } from '../lib/store';
import { placeholderFor } from '../lib/placeholders';

export function Av({ id, sm, lg }: { id: string; sm?: boolean; lg?: boolean }) {
  const { nameOf, state } = useStore();
  const name = nameOf(id);
  const avatar = state.people.find((p) => p.id === id)?.avatar;
  const cls = 'av' + (sm ? ' sm' : '') + (lg ? ' lg' : '');
  if (avatar) return <img className={cls} src={avatar} alt={name} title={name} loading="lazy" />;
  return (
    <span className={cls} style={{ background: `hsl(${hueOf(name + id)} 45% 42%)` }} title={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Pill({ b }: { b: number }) {
  if (Math.abs(b) < 1) return <span className="pill zero">в расчёте</span>;
  return b > 0 ? <span className="pill pos num">+{money(b)}</span> : <span className="pill neg num">−{money(-b)}</span>;
}

/** Фото бара или, если своего нет, иллюстрация (у каждого бара своя) */
export function photoStyle(place?: Partial<Pick<Place, 'id' | 'name' | 'hue' | 'photo'>>): CSSProperties {
  if (place?.photo) return { backgroundImage: `url(${place.photo})` };
  const name = place?.name ?? '?';
  return { backgroundImage: `url("${placeholderFor(place?.id || name, place?.hue ?? hueOf(name))}")` };
}

export function PlacePhoto({ place, className = '', children }: { place?: Place; className?: string; children?: ReactNode }) {
  return (
    <div className={'photo ' + className} style={photoStyle(place)}>
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
