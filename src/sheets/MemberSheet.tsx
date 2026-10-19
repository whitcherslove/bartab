import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { stats } from '../lib/calc';
import { money } from '../lib/format';
import { personalText } from '../lib/messages';
import { Icon } from '../components/Icons';
import { PersonSheet } from './PersonSheet';

export function MemberSheet({ eventId, pid }: { eventId: string; pid: string }) {
  const { state, updateEvent, nameOf } = useStore();
  const ui = useUI();
  const ev = state.events.find((e) => e.id === eventId);
  const person = state.people.find((p) => p.id === pid);
  if (!ev || !person) return null;

  const st = stats(ev, pid);
  const placeName = state.places.find((p) => p.id === ev.placeId)?.name ?? 'Посиделка';
  const payerName = ev.payer ? nameOf(ev.payer) : '';
  const link = person.tg
    ? `https://t.me/${encodeURIComponent(person.tg)}?text=${encodeURIComponent(personalText(ev, pid, placeName, nameOf))}`
    : '';

  let status = 'Пока не отмечено, кто оплатил счёт';
  if (ev.payer) {
    if (st.isPayer) status = st.balance > 1 ? `Оплатил счёт, ждёт ещё ${money(st.balance)}` : 'Оплатил счёт, все уже перевели ✅';
    else status = st.settled ? `Перевёл ${payerName} ✅` : `Должен ${payerName} ${money(st.owed)}`;
  }

  const toggle = () => {
    updateEvent(eventId, (e) => {
      e.settled = st.settled ? e.settled.filter((m) => m !== pid) : [...e.settled, pid];
    });
    ui.close();
    ui.toast(st.settled ? `${person.name}: отметка снята` : `${person.name} перевёл ✅`);
  };

  return (
    <>
      <h4>{person.name}</h4>
      <div className="kv"><span>Позиции</span><b className="num">{money(st.food)}</b></div>
      <div className="kv"><span>Доля чаевых</span><b className="num">{money(st.tip)}</b></div>
      <div className="kv"><span>Его часть</span><b className="num">{money(st.owed)}</b></div>
      <p style={{ margin: '14px 0 0', fontWeight: 600 }}>{status}</p>
      <div className="sheet-btns" style={{ marginTop: 14, flexDirection: 'column' }}>
        {ev.payer && !st.isPayer && (
          <button className="btn block" onClick={toggle}>{st.settled ? 'Снять отметку о переводе' : 'Отметить, что перевёл'}</button>
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
