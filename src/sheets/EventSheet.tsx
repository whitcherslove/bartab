import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { CURRENCIES, getDefaultCurrency, todayIso, toggleIn, uid } from '../lib/format';
import { CategorySeg, PeopleChips } from '../components/common';
import { DEFAULT_CATEGORY, catOf, type Category } from '../lib/categories';

export function EventSheet({ id }: { id?: string }) {
  const { state, update, updateEvent } = useStore();
  const ui = useUI();
  const ev = id ? state.events.find((e) => e.id === id) : undefined;

  const startCat: Category = (ev && state.places.find((p) => p.id === ev.placeId)?.category) || DEFAULT_CATEGORY;
  const [cat, setCat] = useState<Category>(startCat);
  const placesIn = (c: Category) => state.places.filter((p) => (p.category || 'bar') === c);
  const [placeId, setPlaceId] = useState(ev?.placeId ?? placesIn(startCat)[0]?.id ?? '');
  const changeCat = (c: Category) => {
    setCat(c);
    if (!placesIn(c).some((p) => p.id === placeId)) setPlaceId(placesIn(c)[0]?.id ?? '');
  };
  const [date, setDate] = useState(ev?.date ?? todayIso());
  const [members, setMembers] = useState<string[]>(ev?.members ?? state.people.filter((p) => !p.archived).map((p) => p.id));
  const [currency, setCurrency] = useState(ev?.currency ?? getDefaultCurrency());

  const save = () => {
    if (!members.length) return ui.toast('Отметь хотя бы одного участника');
    if (id) {
      updateEvent(id, (e) => {
        Object.assign(e, { placeId, date, members, currency });
        if (cat !== 'bar') e.tips = 0; // в магазине и кино чаевых нет
        if (!members.includes(e.payer)) e.payer = '';
        e.settled = e.settled.filter((m) => members.includes(m));
      });
      ui.close();
      ui.toast('Встреча сохранена');
    } else {
      const newId = uid();
      update((d) => {
        d.events.push({ id: newId, date, placeId, members, currency, tips: 0, tipsMode: 'sum', payer: '', settled: [], status: '', items: [] });
      });
      ui.go({ screen: 'event', id: newId });
      ui.toast('Встреча создана');
    }
  };

  const remove = () => {
    if (!id || !confirm('Удалить встречу со всеми позициями?')) return;
    update((d) => { d.events = d.events.filter((e) => e.id !== id); });
    ui.closeAndBack();
    ui.toast('Встреча удалена');
  };

  return (
    <>
      <h4>{id ? 'Встреча' : 'Новая встреча'}</h4>
      <div className="field">
        <span>Куда</span>
        <CategorySeg value={cat} onChange={changeCat} one />
      </div>
      <label className="field">
        <span>{catOf(cat).one}</span>
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
          {placesIn(cat).length === 0 && <option value="">Пока нет — добавь во вкладке «Места»</option>}
          <option value="" hidden={placesIn(cat).length === 0}>Без места</option>
          {placesIn(cat).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <div className="two">
        <label className="field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Валюта</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
      </div>
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
