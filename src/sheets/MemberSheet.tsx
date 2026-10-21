import { useStore } from '../lib/store';
import { catOf } from '../lib/categories';
import { useUI } from '../lib/ui';
import { personItems, stats } from '../lib/calc';
import { money } from '../lib/format';
import { personalText } from '../lib/messages';
import { Icon } from '../components/Icons';
import { PersonSheet } from './PersonSheet';
import { Av } from '../components/common';

export function MemberSheet({ eventId, pid }: { eventId: string; pid: string }) {
  const { state, updateEvent, nameOf } = useStore();
  const ui = useUI();
  const ev = state.events.find((e) => e.id === eventId);
  const person = state.people.find((p) => p.id === pid);
  if (!ev || !person) return null;

  const st = stats(ev, pid);
  const items = personItems(ev, pid);
  const placeName = state.places.find((p) => p.id === ev.placeId)?.name ?? 'Встреча';
  const payerName = ev.payer ? nameOf(ev.payer) : '';
  const link = person.tg
    ? `https://t.me/${encodeURIComponent(person.tg)}?text=${encodeURIComponent(personalText(ev, pid, placeName, nameOf, catOf(state.places.find((p) => p.id === ev.placeId)?.category).emoji))}`
    : '';

  let status = 'Пока не отмечено, кто заплатил по счёту';
  if (ev.payer) {
    if (st.isPayer) status = st.balance > 1 ? `Плательщик · ждёт ещё ${money(st.balance, ev.currency)}` : 'Плательщик · все переводы получены ✅';
    else status = st.settled ? `Перевод для: ${payerName} — отмечен ✅` : `К переводу ${money(st.owed, ev.currency)} → ${payerName}`;
  }

  const toggle = () => {
    updateEvent(eventId, (e) => {
      e.settled = st.settled ? e.settled.filter((m) => m !== pid) : [...e.settled, pid];
    });
    ui.close();
    ui.toast(st.settled ? `${person.name}: отметка снята` : `${person.name}: перевод отмечен ✅`);
  };

  return (
    <>
      <div className="member-head">
        <Av id={pid} lg />
        <div className="grow">
          <h4>{person.name}</h4>
          {person.tg && <div className="s">@{person.tg}</div>}
        </div>
      </div>
      {items.length > 0 ? (
        <div className="member-items">
          {items.map((it) => (
            <div key={it.id} className="row">
              <div className="grow"><div className="t">{it.name}</div><div className="s">{it.detail}</div></div>
              <span className="amt num">{money(it.amount, ev.currency)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="hint" style={{ margin: '0 0 10px' }}>Пока ни одной позиции не отмечено на этого человека.</p>
      )}
      <div className="kv"><span>Позиции</span><b className="num">{money(st.food, ev.currency)}</b></div>
      <div className="kv"><span>Доля чаевых</span><b className="num">{money(st.tip, ev.currency)}</b></div>
      <div className="kv"><span>Итого за человека</span><b className="num">{money(st.owed, ev.currency)}</b></div>
      <p style={{ margin: '14px 0 0', fontWeight: 600 }}>{status}</p>
      <div className="sheet-btns" style={{ marginTop: 14, flexDirection: 'column' }}>
        {ev.payer && !st.isPayer && (
          <button className="btn block" onClick={toggle}>{st.settled ? 'Снять отметку о переводе' : 'Отметить перевод'}</button>
        )}
        {link ? (
          <a className="btn primary block" href={link} target="_blank" rel="noopener">{Icon.send} Написать в Telegram</a>
        ) : (
          <button className="btn block" onClick={() => ui.open(<PersonSheet id={pid} />)}>Добавить Telegram</button>
        )}
      </div>
    </>
  );
}
