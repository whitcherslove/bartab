import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { useCached } from '../lib/cached';
import { fetchMyVisits, type Visit } from '../lib/remote';
import { fdate } from '../lib/format';
import { catOf } from '../lib/categories';
import { personPlaceholderFor } from '../lib/placeholders';
import type { Place } from '../lib/types';
import { CrewAvatar, PlacePhoto } from './common';

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const asPlace = (p: NonNullable<Visit['place']>): Place => ({ ...p, mapUrl: '', lat: null, lon: null });
const shortDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}.${m}`; };

/** Лог встреч по месяцам: фото места, компания, дата, участники */
function HistoryLog({ visits }: { visits: Visit[] }) {
  const acc = useAccount();
  const ui = useUI();
  const [limit, setLimit] = useState(30);
  const crewOf = (id: string) => acc.crews.find((c) => c.id === id) ?? { id, name: 'Компания', avatar_url: '' };

  const open = (v: Visit) => {
    if (v.crewId !== acc.crew.id) acc.setCrewId(v.crewId);
    ui.go({ screen: 'event', id: v.eventId });
  };

  // группируем по месяцам
  const shown = visits.slice(0, limit);
  const groups: { key: string; title: string; total: number; list: Visit[] }[] = [];
  for (const v of shown) {
    const key = v.date.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const [y, m] = key.split('-');
      g = { key, title: `${MONTHS[Number(m) - 1]} ${y}`, total: visits.filter((x) => x.date.startsWith(key)).length, list: [] };
      groups.push(g);
    }
    g.list.push(v);
  }

  return (
    <>
      <h4>История встреч</h4>
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="log-month">{g.title} <small>{g.total} {plural(g.total, 'встреча', 'встречи', 'встреч')}</small></h3>
          <div className="list">
            {g.list.map((v) => (
              <button key={v.eventId} className="row log-row" onClick={() => open(v)}>
                {v.place ? <PlacePhoto place={asPlace(v.place)} className="place-thumb" /> : <CrewAvatar crew={crewOf(v.crewId)} size={52} />}
                <div className="grow">
                  <div className="t"><span className="cat-emoji" aria-hidden="true">{catOf(v.category).emoji}</span>{v.place?.name ?? 'Без места'}</div>
                  <div className="s">{crewOf(v.crewId).name} · {fdate(v.date)}</div>
                  <div className="log-people">
                    {v.people.slice(0, 5).map((p) => (
                      <img key={p.id} className="av sm" src={p.avatar || personPlaceholderFor(p.userId || p.id)} alt={p.name} title={p.name} loading="lazy" />
                    ))}
                    {v.people.length > 5 && <span className="log-more">+{v.people.length - 5}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
      {visits.length > limit && (
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => setLimit(limit + 30)}>Показать ещё</button>
      )}
    </>
  );
}

/** Карточка в профиле: цифры и лента последних встреч; тап — лог */
export function MyVisits() {
  const acc = useAccount();
  const ui = useUI();
  const uid = acc.session.user.id;
  // сразу из запомненного, свежее — в фоне
  const { data: visits, error } = useCached<Visit[]>(`visits:${uid}`, () => fetchMyVisits(uid));

  if (error) return <div className="list"><div className="empty">Не удалось загрузить историю. Проверь интернет.</div></div>;
  if (!visits) return <div className="list"><div className="empty">Загружаю…</div></div>;
  if (!visits.length) return <div className="list"><div className="empty">Пока ни одной встречи. Самое время позвать друзей 🍻</div></div>;

  const places = new Set(visits.filter((v) => v.place).map((v) => v.place!.id)).size;
  const crews = new Set(visits.map((v) => v.crewId)).size;
  const crewOf = (id: string) => acc.crews.find((c) => c.id === id) ?? { id, name: 'Компания', avatar_url: '' };

  return (
    <button className="history-card" onClick={() => ui.open(<HistoryLog visits={visits} />)} aria-label="Открыть историю встреч">
      <div className="grow">
        <div className="history-nums">
          <div><b className="num">{visits.length}</b><span>{plural(visits.length, 'встреча', 'встречи', 'встреч')}</span></div>
          <div><b className="num">{places}</b><span>{plural(places, 'место', 'места', 'мест')}</span></div>
          <div><b className="num">{crews}</b><span>{plural(crews, 'компания', 'компании', 'компаний')}</span></div>
        </div>
        <div className="history-strip">
          {visits.slice(0, 5).map((v) => (
            <span key={v.eventId} className="strip-item">
              {v.place ? <PlacePhoto place={asPlace(v.place)} className="strip-photo" /> : <CrewAvatar crew={crewOf(v.crewId)} size={52} />}
              <span className="strip-date">{shortDate(v.date)}</span>
            </span>
          ))}
        </div>
      </div>
      <span className="history-more" aria-hidden="true">›</span>
    </button>
  );
}
