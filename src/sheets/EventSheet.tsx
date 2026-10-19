import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { todayIso, toggleIn, uid } from '../lib/format';
import { PeopleChips } from '../components/common';

export function EventSheet({ id }: { id?: string }) {
  const { state, update, updateEvent } = useStore();
  const ui = useUI();
  const ev = id ? state.events.find((e) => e.id === id) : undefined;

  const [placeId, setPlaceId] = useState(ev?.placeId ?? state.places[0]?.id ?? '');
  const [date, setDate] = useState(ev?.date ?? todayIso());
  const [members, setMembers] = useState<string[]>(ev?.members ?? [state.me]);

  const save = () => {
    if (!members.length) return ui.toast('Отметь хотя бы одного участника');
    if (id) {
      updateEvent(id, (e) => {
        Object.assign(e, { placeId, date, members });
        if (!members.includes(e.payer)) e.payer = '';
        e.settled = e.settled.filter((m) => members.includes(m));
      });
      ui.close();
      ui.toast('Посиделка сохранена');
    } else {
      const newId = uid();
      update((d) => {
        d.events.push({ id: newId, date, placeId, members, tips: 0, tipsMode: 'sum', payer: '', settled: [], status: '', items: [] });
      });
      ui.go({ screen: 'event', id: newId });
      ui.toast('Посиделка создана');
    }
  };

  const remove = () => {
    if (!id || !confirm('Удалить посиделку со всеми позициями?')) return;
    update((d) => { d.events = d.events.filter((e) => e.id !== id); });
    ui.closeAndBack();
    ui.toast('Посиделка удалена');
  };

  return (
    <>
      <h4>{id ? 'Посиделка' : 'Новая посиделка'}</h4>
      <label className="field">
        <span>Бар</span>
        <select value={placeId} onChange={(e) => setPlaceId(e.target.value)}>
          {state.places.length === 0 && <option value="">Без места</option>}
          {state.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Дата</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="field">
        <span>Кто был</span>
        <PeopleChips ids={state.people.map((p) => p.id)} selected={members} onToggle={(pid) => setMembers(toggleIn(members, pid))} />
      </div>
      <div className="sheet-btns">
        {id && <button className="btn danger" onClick={remove}>Удалить</button>}
        <button className="btn primary" onClick={save}>{id ? 'Сохранить' : 'Создать'}</button>
      </div>
    </>
  );
}
