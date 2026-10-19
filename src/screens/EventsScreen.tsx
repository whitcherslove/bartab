import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { evWithTips, stats } from '../lib/calc';
import { fdate, money } from '../lib/format';
import { Fab, Pill, PlacePhoto } from '../components/common';
import { EventSheet } from '../sheets/EventSheet';

export function EventsScreen() {
  const { state } = useStore();
  const ui = useUI();
  const list = [...state.events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <header className="top"><h1>Посиделки</h1></header>
      <Fab label="Посиделка" onClick={() => ui.open(<EventSheet />)} />
      {list.length === 0 && (
        <div className="empty">
          Пока ни одной посиделки.
          <br /><br />
          <button className="btn primary" onClick={() => ui.open(<EventSheet />)}>Создать первую</button>
        </div>
      )}
      {list.map((ev) => {
        const place = state.places.find((p) => p.id === ev.placeId);
        return (
          <button key={ev.id} className="ev-card" onClick={() => ui.go({ screen: 'event', id: ev.id })}>
            <PlacePhoto place={place} />
            <div className="body">
              <p className="place">{place?.name ?? 'Без места'}</p>
              <div className="sum num">{money(evWithTips(ev))}</div>
              <div className="meta">{fdate(ev.date)}, {ev.members.length} чел.</div>
              <div>{ev.members.includes(state.me) && <Pill b={stats(ev, state.me).balance} me />}</div>
            </div>
          </button>
        );
      })}
    </>
  );
}
