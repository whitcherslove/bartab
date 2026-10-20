import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { fetchMyVisits, type Visit } from '../lib/remote';
import { fdate } from '../lib/format';
import type { Place } from '../lib/types';
import { CrewAvatar, PlacePhoto } from './common';
import { CATEGORIES, catOf } from '../lib/categories';

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const asPlace = (p: NonNullable<Visit['place']>): Place => ({ ...p, mapUrl: '', lat: null, lon: null });

/** Подробная история: где и с кем бываешь, по всем компаниям */
export function HistorySheet({ visits }: { visits: Visit[] }) {
  const acc = useAccount();
  const ui = useUI();

  const crewName = (id: string) => acc.crews.find((c) => c.id === id)?.name ?? 'Компания';
  const crewOf = (id: string) => acc.crews.find((c) => c.id === id) ?? { id, name: crewName(id), avatar_url: '' };

  // бары: сколько раз, когда последний, с какими компаниями
  const bars = new Map<string, { place: NonNullable<Visit['place']>; n: number; last: string; crews: Map<string, number> }>();
  for (const v of visits) {
    if (!v.place) continue;
    const b = bars.get(v.place.id) ?? { place: v.place, n: 0, last: v.date, crews: new Map() };
    b.n++;
    if (v.date > b.last) b.last = v.date;
    b.crews.set(v.crewId, (b.crews.get(v.crewId) ?? 0) + 1);
    bars.set(v.place.id, b);
  }
  const topBars = [...bars.values()].sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));

  // компании: сколько встреч и в скольких барах
  const crews = new Map<string, { n: number; bars: Set<string> }>();
  for (const v of visits) {
    const c = crews.get(v.crewId) ?? { n: 0, bars: new Set<string>() };
    c.n++;
    if (v.place) c.bars.add(v.place.id);
    crews.set(v.crewId, c);
  }
  const topCrews = [...crews.entries()].sort((a, b) => b[1].n - a[1].n);

  const open = (v: Visit) => {
    if (v.crewId !== acc.crew.id) acc.setCrewId(v.crewId);
    ui.go({ screen: 'event', id: v.eventId });
  };

  return (
    <>
      <h4>Моя история</h4>
      <div className="visits-summary">
        <div><b className="num">{visits.length}</b><span>{plural(visits.length, 'встреча', 'встречи', 'встреч')}</span></div>
        <div><b className="num">{bars.size}</b><span>{plural(bars.size, 'место', 'места', 'мест')}</span></div>
        <div><b className="num">{crews.size}</b><span>{plural(crews.size, 'компания', 'компании', 'компаний')}</span></div>
      </div>
      <p className="hint visits-cats">
        {CATEGORIES.map((c) => {
          const n = visits.filter((v) => (v.place?.category ?? 'bar') === c.id).length;
          return n ? <span key={c.id}>{c.emoji} {c.many.toLowerCase()} — {n}</span> : null;
        })}
      </p>

      {topBars.length > 0 && (
        <>
          <h3>Где бываешь</h3>
          <div className="list">
            {topBars.slice(0, 10).map((b) => (
              <div key={b.place.id} className="row">
                <PlacePhoto place={asPlace(b.place)} className="place-thumb" />
                <div className="grow">
                  <div className="t"><span className="cat-emoji" aria-hidden="true">{catOf(b.place.category).emoji}</span>{b.place.name}</div>
                  <div className="s">{b.n} {plural(b.n, 'раз', 'раза', 'раз')} · последний раз {fdate(b.last)}</div>
                  <div className="visit-crews">
                    {[...b.crews.entries()].map(([cid, n]) => (
                      <span key={cid} className="visit-crew" title={crewName(cid)}>
                        <CrewAvatar crew={crewOf(cid)} size={18} />{n > 1 ? `×${n}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {topCrews.length > 1 && (
        <>
          <h3>С кем</h3>
          <div className="list">
            {topCrews.map(([cid, c]) => (
              <div key={cid} className="row">
                <CrewAvatar crew={crewOf(cid)} size={40} />
                <div className="grow">
                  <div className="t">{crewName(cid)}</div>
                  <div className="s">{c.n} {plural(c.n, 'встреча', 'встречи', 'встреч')} · {c.bars.size} {plural(c.bars.size, 'место', 'места', 'мест')}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>Последние</h3>
      <div className="list">
        {visits.slice(0, 10).map((v) => (
          <button key={v.eventId} className="row" onClick={() => open(v)}>
            {v.place ? <PlacePhoto place={asPlace(v.place)} className="place-thumb sm" /> : <CrewAvatar crew={crewOf(v.crewId)} size={40} />}
            <div className="grow">
              <div className="t"><span className="cat-emoji" aria-hidden="true">{catOf(v.place?.category).emoji}</span>{v.place?.name ?? 'Без места'}</div>
              <div className="s">{crewName(v.crewId)} · {fdate(v.date)}</div>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/** Компактная карточка в профиле: сводка и любимые места; тап — подробная история */
export function MyVisits() {
  const acc = useAccount();
  const ui = useUI();
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchMyVisits(acc.session.user.id).then(setVisits).catch(() => setError(true));
  }, [acc.session.user.id]);

  if (error) return <div className="list"><div className="empty">Не удалось загрузить историю. Проверь интернет.</div></div>;
  if (!visits) return <div className="list"><div className="empty">Загружаю…</div></div>;
  if (!visits.length) return <div className="list"><div className="empty">Пока ни одной встречи. Самое время позвать друзей 🍻</div></div>;

  const places = new Map<string, { place: NonNullable<Visit['place']>; n: number }>();
  for (const v of visits) if (v.place) places.set(v.place.id, { place: v.place, n: (places.get(v.place.id)?.n ?? 0) + 1 });
  const top = [...places.values()].sort((a, b) => b.n - a.n).slice(0, 4);
  const crews = new Set(visits.map((v) => v.crewId)).size;
  const cats = CATEGORIES.map((c) => ({ c, n: visits.filter((v) => (v.place?.category ?? 'bar') === c.id).length })).filter((x) => x.n);

  return (
    <button className="history-card" onClick={() => ui.open(<HistorySheet visits={visits} />)}>
      <div className="grow">
        <div className="history-line">
          {visits.length} {plural(visits.length, 'встреча', 'встречи', 'встреч')} · {places.size} {plural(places.size, 'место', 'места', 'мест')} · {crews} {plural(crews, 'компания', 'компании', 'компаний')}
        </div>
        <div className="history-cats">{cats.map(({ c, n }) => <span key={c.id}>{c.emoji} {n}</span>)}</div>
        <div className="history-thumbs">
          {top.map(({ place, n }) => (
            <span key={place.id} className="history-thumb">
              <PlacePhoto place={asPlace(place)} className="place-thumb sm" />
              {n > 1 && <i>×{n}</i>}
            </span>
          ))}
        </div>
      </div>
      <span className="history-more" aria-hidden="true">›</span>
    </button>
  );
}
