import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { fetchMyDebts, type OpenDebt } from '../lib/remote';
import { fdate, money } from '../lib/format';
import { catOf } from '../lib/categories';

/** Итог по валютам: «1 300 ₽ · 20 $» */
const totals = (list: OpenDebt[]) => {
  const t: Record<string, number> = {};
  list.forEach((d) => { t[d.currency] = (t[d.currency] ?? 0) + d.amount; });
  return Object.entries(t).map(([c, n]) => money(n, c)).join(' · ');
};

/** «Ждёшь» и «От тебя ждут» — по всем компаниям, по встречам */
export function MyDebts() {
  const acc = useAccount();
  const ui = useUI();
  const [data, setData] = useState<{ waiting: OpenDebt[]; owing: OpenDebt[] } | null>(null);

  useEffect(() => {
    fetchMyDebts(acc.session.user.id).then(setData).catch(() => setData({ waiting: [], owing: [] }));
  }, [acc.session.user.id]);

  if (!data) return null;
  if (!data.waiting.length && !data.owing.length) {
    return (
      <>
        <h3>Долги</h3>
        <div className="list"><div className="empty">Ты со всеми в расчёте ✅</div></div>
      </>
    );
  }

  const crewName = (id: string) => acc.crews.find((c) => c.id === id)?.name ?? 'Компания';
  const open = (d: OpenDebt) => {
    if (d.crewId !== acc.crew.id) acc.setCrewId(d.crewId);
    ui.go({ screen: 'event', id: d.eventId });
  };

  const block = (title: string, list: OpenDebt[], kind: 'pos' | 'neg') =>
    list.length > 0 && (
      <>
        <h3><span>{title}</span><small className={'debt-total ' + kind}>{totals(list)}</small></h3>
        <div className="list">
          {list.map((d) => (
            <button key={d.eventId} className="row" onClick={() => open(d)}>
              <div className="grow">
                <div className="t"><span className="cat-emoji" aria-hidden="true">{catOf(d.placeCategory).emoji}</span>{d.placeName}</div>
                <div className="s">{crewName(d.crewId)} · {fdate(d.date)}</div>
                <div className="s debt-people">
                  {kind === 'pos'
                    ? d.people.map((p) => `${p.name} ${money(p.amount, d.currency)}`).join(', ')
                    : `переведи ${d.people[0]?.name ?? ''}`}
                </div>
              </div>
              <span className={'amt num debt-amt ' + kind}>{money(d.amount, d.currency)}</span>
            </button>
          ))}
        </div>
      </>
    );

  return (
    <>
      {block('Ждёшь', data.waiting, 'pos')}
      {block('От тебя ждут', data.owing, 'neg')}
    </>
  );
}
