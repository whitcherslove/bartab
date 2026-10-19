import type { CSSProperties, ReactNode } from 'react';
import type { Place } from '../lib/types';
import { hueOf, money } from '../lib/format';
import { useStore } from '../lib/store';
import { crewPlaceholderFor, personPlaceholderFor, placeholderFor } from '../lib/placeholders';

export function Av({ id, sm, lg }: { id: string; sm?: boolean; lg?: boolean }) {
  const { nameOf, state } = useStore();
  const name = nameOf(id);
  const person = state.people.find((p) => p.id === id);
  // своё фото или значок; ключ — аккаунт, чтобы значок совпадал с профилем во всех компаниях
  const src = person?.avatar || personPlaceholderFor(person?.userId || id);
  return <img className={'av' + (sm ? ' sm' : '') + (lg ? ' lg' : '')} src={src} alt={name} title={name} loading="lazy" />;
}

/** Баланс словами: «тебе должны 1 300 ₽» / «должен 700 ₽» / «в расчёте» */
export function Pill({ b, me }: { b: number; me?: boolean }) {
  if (Math.abs(b) < 1) return <span className="pill zero">в расчёте</span>;
  return b > 0
    ? <span className="pill pos num">{me ? 'тебе должны' : 'ему должны'} {money(b)}</span>
    : <span className="pill neg num">{me ? 'ты должен' : 'должен'} {money(-b)}</span>;
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

/** Аватарка компании: своё фото или иллюстрация (у каждой компании своя) */
export function CrewAvatar({ crew, size = 40 }: { crew: { id: string; name: string; avatar_url?: string }; size?: number }) {
  return (
    <img
      className="crew-av"
      src={crew.avatar_url || crewPlaceholderFor(crew.id)}
      alt=""
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}

/** Плавающая кнопка в правом нижнем углу, над вкладками */
export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="fab" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      {label}
    </button>
  );
}
