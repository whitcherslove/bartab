import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { Icon } from '../components/Icons';
import { PlacePhoto } from '../components/common';
import { PlaceSheet } from '../sheets/PlaceSheet';

export function PlacesScreen() {
  const { state } = useStore();
  const ui = useUI();

  return (
    <>
      <header className="top">
        <h1>Бары</h1>
        <button className="icon-btn" aria-label="Добавить бар" onClick={() => ui.open(<PlaceSheet />)}>{Icon.plus}</button>
      </header>
      <div className="list">
        {state.places.length === 0 && <div className="empty">Добавь любимый бар</div>}
        {state.places.map((p) => (
          <button key={p.id} className="row" onClick={() => ui.open(<PlaceSheet id={p.id} />)}>
            <PlacePhoto place={p} className="place-thumb" />
            <div className="grow">
              <div className="t">{p.name}</div>
              <div className="s">{p.address || 'Адрес не указан'}</div>
            </div>
            <span className="s">{state.events.filter((e) => e.placeId === p.id).length} раз</span>
          </button>
        ))}
      </div>
    </>
  );
}
