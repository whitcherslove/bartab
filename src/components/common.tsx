import type { CSSProperties, ReactNode } from 'react';
import type { Place } from '../lib/types';
import { hueOf, money } from '../lib/format';
import { useStore } from '../lib/store';
import { crewPlaceholderFor, personPlaceholderFor, placeholderFor } from '../lib/placeholders';
import { CATEGORIES, type Category } from '../lib/categories';

export function Av({ id, sm, lg }: { id: string; sm?: boolean; lg?: boolean }) {
  const { nameOf, state } = useStore();
  const name = nameOf(id);
  const person = state.people.find((p) => p.id === id);
  // своё фото или значок; ключ — аккаунт, чтобы значок совпадал с профилем во всех компаниях
  const src = person?.avatar || personPlaceholderFor(person?.userId || id);
  return <img className={'av' + (sm ? ' sm' : '') + (lg ? ' lg' : '')} src={src} alt={name} title={name} loading="lazy" />;
}

/** Баланс словами: «тебе должны 1 300 ₽» / «должен 700 ₽» / «в расчёте» */
export function Pill({ b, me, cur }: { b: number; me?: boolean; cur?: string }) {
  if (Math.abs(b) < 1) return <span className="pill zero">в расчёте</span>;
  return b > 0
    ? <span className="pill pos num">{me ? 'тебе должны' : 'ждёт'} {money(b, cur)}</span>
    : <span className="pill neg num">{me ? 'от тебя ждут' : 'к переводу'} {money(-b, cur)}</span>;
}

/** Балансы в нескольких валютах: «должен 700 ₽ · 20 $» */
export function MultiPill({ balances, me }: { balances: Record<string, number>; me?: boolean }) {
  const entries = Object.entries(balances).filter(([, b]) => Math.abs(b) >= 1);
  if (!entries.length) return <span className="pill zero">в расчёте</span>;
  const pos = entries.filter(([, b]) => b > 0), neg = entries.filter(([, b]) => b < 0);
  return (
    <span className="multi-pill">
      {pos.length > 0 && <span className="pill pos num">{me ? 'тебе должны' : 'ждёт'} {pos.map(([c, b]) => money(b, c)).join(' · ')}</span>}
      {neg.length > 0 && <span className="pill neg num">{me ? 'от тебя ждут' : 'к переводу'} {neg.map(([c, b]) => money(-b, c)).join(' · ')}</span>}
    </span>
  );
}

/** Фото бара или, если своего нет, иллюстрация (у каждого бара своя) */
export function photoStyle(place?: Partial<Pick<Place, 'id' | 'name' | 'hue' | 'photo' | 'category'>>): CSSProperties {
  if (place?.photo) return { backgroundImage: `url(${place.photo})` };
  const name = place?.name ?? '?';
  return { backgroundImage: `url("${placeholderFor(place?.id || name, place?.hue ?? hueOf(name), place?.category ?? 'bar')}")` };
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

/** Переключатель категорий мест: Бары · Магазины · Кинотеатры */
export function CategorySeg({ value, onChange, one }: { value: Category; onChange: (c: Category) => void; one?: boolean }) {
  return (
    <div className="seg cat-seg">
      {CATEGORIES.map((c) => (
        <button key={c.id} type="button" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
          <span aria-hidden="true">{c.emoji}</span> {one ? c.one : c.many}
        </button>
      ))}
    </div>
  );
}

/** Логотип с названием — на экранах загрузки и входа */
export function Brand() {
  return (
    <div className="brand">
      <img src="/icon-192.png" alt="" width={44} height={44} />
      <span>BarTab</span>
    </div>
  );
}
