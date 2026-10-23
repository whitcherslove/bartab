import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { done } from '../lib/motion';
import { evWithTips, stats } from '../lib/calc';
import { badgeClass, dateBadge, fdate, money } from '../lib/format';
import { coverPlace, CrewAvatar, Fab, Pill, PlacePhoto } from '../components/common';
import { useAccount } from '../lib/account';
import { CrewPickerSheet } from '../sheets/CrewPickerSheet';
import { EventSheet } from '../sheets/EventSheet';
import { catOf, eventCategory } from '../lib/categories';

export function EventsScreen() {
  const { state, update } = useStore();
  const ui = useUI();
  const acc = useAccount();
  const list = [...state.events].sort((a, b) => b.date.localeCompare(a.date));

  // меню карточки: удалить встречу
  const menu = (id: string, title: string, date: string) =>
    ui.open(
      <>
        <h4>{title}</h4>
        <p className="hint" style={{ margin: '-8px 0 16px' }}>{fdate(date)}</p>
        <div className="photo-choice">
          <button className="btn block" onClick={() => ui.go({ screen: 'event', id })}>Открыть</button>
          <button
            className="btn block danger"
            onClick={() => {
              if (!confirm(`Удалить встречу «${title}» со всеми позициями? Отменить будет нельзя.`)) return;
              update((d) => { d.events = d.events.filter((e) => e.id !== id); });
              ui.close();
              done();
            }}
          >
            Удалить встречу
          </button>
        </div>
      </>,
    );

  return (
    <>
      <header className="top">
        <h1>Встречи</h1>
        <button className="crew-btn" onClick={() => ui.open(<CrewPickerSheet />)} aria-label={`Компания «${acc.crew.name}» — сменить`}>
          <CrewAvatar crew={acc.crew} size={38} />
        </button>
      </header>
      <Fab label="Встреча" onClick={() => ui.open(<EventSheet />)} />
      {list.length === 0 && (
        <div className="empty">
          Пока ни одной встречи.
          <br /><br />
          <button className="btn primary" onClick={() => ui.open(<EventSheet />)}>Создать первую</button>
        </div>
      )}
      {list.map((ev) => {
        const place = state.places.find((p) => p.id === ev.placeId);
        return (
          <div key={ev.id} className="ev-card" role="button" tabIndex={0} onClick={() => ui.go({ screen: 'event', id: ev.id })} onKeyDown={(e) => e.key === 'Enter' && ui.go({ screen: 'event', id: ev.id })}>
            <PlacePhoto place={coverPlace(place, ev)}>
              {dateBadge(ev.date) && <span className={badgeClass(dateBadge(ev.date))}>{dateBadge(ev.date)}</span>}
              <button
                className="card-menu"
                aria-label="Действия со встречей"
                onClick={(e) => { e.stopPropagation(); menu(ev.id, place?.name ?? 'Без места', ev.date); }}
              >⋯</button>
            </PlacePhoto>
            <div className="body">
              <p className="place"><span className="cat-emoji" aria-hidden="true">{catOf(eventCategory(ev, state.places)).emoji}</span>{place?.name ?? 'Без места'}</p>
              <div className="sum num">{money(evWithTips(ev), ev.currency)}</div>
              <div className="meta">{fdate(ev.date)}{eventCategory(ev, state.places) === 'cinema' && (ev.film || ev.sessionTime) ? `, ${[ev.film, ev.sessionTime].filter(Boolean).join(' · ')}` : `, ${ev.members.length} чел.`}</div>
              <div>{ev.members.includes(state.me) && <Pill b={stats(ev, state.me).balance} me cur={ev.currency} />}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
