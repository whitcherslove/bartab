import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { getDefaultCurrency, todayIso, toggleIn, uid } from '../lib/format';
import { CategorySeg, PeopleChips, PlacePhoto } from '../components/common';
import { CurrencyPicker, currencyLabel, PickField, PlacePicker } from '../components/Pickers';
import { PlaceSheet } from './PlaceSheet';
import { useAccount } from '../lib/account';
import { sortPlaces } from '../lib/placeOrder';
import { catOf, eventCategory, type Category } from '../lib/categories';
import { done } from '../lib/motion';

/** Заполненное в шторке — чтобы вернуться к нему после создания нового места */
type Draft = { cat: Category; placeId: string; date: string; members: string[]; currency: string; film: string; sessionTime: string; hall: string };

export function EventSheet({ id, draft }: { id?: string; draft?: Draft }) {
  const { state, update, updateEvent } = useStore();
  const ui = useUI();
  const acc = useAccount();
  const ev = id ? state.events.find((e) => e.id === id) : undefined;

  const startCat: Category = draft?.cat ?? eventCategory(ev, state.places);
  const [cat, setCat] = useState<Category>(startCat);
  // места в личном порядке — первое и подставляется по умолчанию
  const placesIn = (c: Category) => sortPlaces(state.places, acc.profile.place_order ?? []).filter((p) => (p.category || 'bar') === c);
  const [placeId, setPlaceId] = useState(draft?.placeId ?? ev?.placeId ?? placesIn(startCat)[0]?.id ?? '');
  // выбор места или валюты — внутри этой же шторки, заполненное не теряется
  const [pick, setPick] = useState<'' | 'place' | 'currency'>('');
  const changeCat = (c: Category) => {
    setCat(c);
    if (!placesIn(c).some((p) => p.id === placeId)) setPlaceId(placesIn(c)[0]?.id ?? '');
  };
  const [date, setDate] = useState(draft?.date ?? ev?.date ?? todayIso());
  const [members, setMembers] = useState<string[]>(draft?.members ?? ev?.members ?? state.people.filter((p) => !p.archived).map((p) => p.id));
  const [currency, setCurrency] = useState(draft?.currency ?? ev?.currency ?? getDefaultCurrency());
  const [film, setFilm] = useState(draft?.film ?? ev?.film ?? '');
  const [sessionTime, setSessionTime] = useState(draft?.sessionTime ?? ev?.sessionTime ?? '');
  const [hall, setHall] = useState(draft?.hall ?? ev?.hall ?? '');

  // новое место: после сохранения возвращаемся сюда же, с ним выбранным
  const newPlace = () => {
    const keep: Draft = { cat, placeId, date, members, currency, film, sessionTime, hall };
    ui.open(<PlaceSheet category={cat} onCreated={(pid) => ui.open(<EventSheet id={id} draft={{ ...keep, placeId: pid }} />)} />);
  };

  const save = () => {
    if (!members.length) return ui.fail('Отметь хотя бы одного участника');
    if (id) {
      updateEvent(id, (e) => {
        Object.assign(e, { placeId, date, members, currency, category: cat });
        if (cat === 'cinema') Object.assign(e, { film: film.trim(), sessionTime: sessionTime.trim(), hall: hall.trim() });
        if (cat === 'cinema') e.tips = 0; // в кино чаевых нет
        if (!members.includes(e.payer)) e.payer = '';
        e.settled = e.settled.filter((m) => members.includes(m));
      });
      ui.close();
      done();
    } else {
      const newId = uid();
      update((d) => {
        d.events.push({ id: newId, date, placeId, members, currency, category: cat, film: cat === 'cinema' ? film.trim() : '', sessionTime: cat === 'cinema' ? sessionTime.trim() : '', hall: cat === 'cinema' ? hall.trim() : '', tips: 0, tipsMode: 'sum', payer: '', settled: [], status: '', items: [] });
      });
      ui.go({ screen: 'event', id: newId });
      done();
    }
  };

  const remove = () => {
    if (!id || !confirm('Удалить встречу со всеми позициями?')) return;
    update((d) => { d.events = d.events.filter((e) => e.id !== id); });
    ui.closeAndBack();
    done();
  };

  if (pick === 'place') {
    const one = catOf(cat).one;
    return (
      <PlacePicker
        title={cat === 'other' ? 'Где' : one}
        places={placesIn(cat)}
        value={placeId}
        onPick={(pid) => { setPlaceId(pid); setPick(''); }}
        onBack={() => setPick('')}
        onNew={newPlace}
        newLabel={cat === 'bar' ? 'Новый бар' : cat === 'cinema' ? 'Новый кинотеатр' : 'Новое место'}
      />
    );
  }
  if (pick === 'currency') {
    return <CurrencyPicker value={currency} onPick={(c) => { setCurrency(c); setPick(''); }} onBack={() => setPick('')} />;
  }

  const place = state.places.find((p) => p.id === placeId);

  return (
    <>
      <h4>{id ? 'Встреча' : 'Новая встреча'}</h4>
      <div className="field">
        <span>Куда</span>
        <CategorySeg value={cat} onChange={changeCat} one />
      </div>
      <PickField label={catOf(cat).one} onClick={() => setPick('place')}>
        {place ? (
          <span className="pick-place">
            <PlacePhoto place={place} className="place-thumb sm" />
            <span className="grow">
              <span className="t">{place.name}</span>
              {place.address && <span className="s">{place.address}</span>}
            </span>
          </span>
        ) : (
          <span className="pick-empty">{placesIn(cat).length ? 'Без места' : 'Выбрать или добавить'}</span>
        )}
      </PickField>
      <div className="two">
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <PickField label="Валюта" onClick={() => setPick('currency')}>{currencyLabel(currency)}</PickField>
      </div>
      {cat === 'cinema' && (
        <>
          <label className="field"><span>Фильм</span><input value={film} onChange={(e) => setFilm(e.target.value)} placeholder="Подтянется с билетов или впиши вручную" /></label>
          <div className="two">
            <label className="field"><span>Время сеанса</span><input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} /></label>
            <label className="field"><span>Зал</span><input value={hall} onChange={(e) => setHall(e.target.value)} placeholder="Зал 3" /></label>
          </div>
        </>
      )}
      <div className="field">
        <span>Участники</span>
        <PeopleChips ids={state.people.filter((p) => !p.archived || members.includes(p.id)).map((p) => p.id)} selected={members} onToggle={(pid) => setMembers(toggleIn(members, pid))} />
      </div>
      <div className="sheet-btns">
        {id && <button className="btn danger" onClick={remove}>Удалить</button>}
        <button className="btn primary" onClick={save}>{id ? 'Сохранить' : 'Создать'}</button>
      </div>
    </>
  );
}
