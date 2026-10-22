import { useState } from 'react';
import type { Item, SplitMode } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { evenSplit } from '../lib/calc';
import { money, parseNum, toggleIn, uid } from '../lib/format';
import { Av, PeopleChips } from '../components/common';

export function ItemSheet({ eventId, itemId }: { eventId: string; itemId?: string }) {
  const { state, updateEvent, nameOf } = useStore();
  const ui = useUI();
  const ev = state.events.find((e) => e.id === eventId);
  const existing = itemId ? ev?.items.find((i) => i.id === itemId) : undefined;
  const members = ev?.members ?? [];
  const category = state.places.find((p) => p.id === ev?.placeId)?.category ?? 'bar';
  const texts = {
    bar: { ph: 'Например, IPA 0,5', who: 'Отметь, кто пил или ел' },
    other: { ph: 'Например, Пицца', who: 'Отметь, кто ел или для кого это' },
    cinema: { ph: 'Например, Билет', who: 'Отметь, для кого это' },
  }[category];

  const [name, setName] = useState(existing?.name ?? '');
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [qtyText, setQtyText] = useState(String(existing?.qty ?? 1));
  const [mode, setMode] = useState<SplitMode>(existing?.splitMode ?? 'equal');
  const [consumers, setConsumers] = useState<string[]>(existing?.consumers ?? []);
  const [split, setSplit] = useState<Record<string, number>>(existing?.split ?? {});

  if (!ev) return null;

  const qty = Math.max(1, Math.round(parseNum(qtyText) || 1));
  const priceNum = parseNum(price);
  const used = members.reduce((s, m) => s + (split[m] || 0), 0);
  const left = qty - used;
  const fromSplit = () => Object.keys(split).filter((m) => split[m] > 0);

  const onQty = (v: string) => {
    setQtyText(v);
    const q = Math.max(1, Math.round(parseNum(v) || 1));
    if (q === 1 && mode === 'qty') { setConsumers(fromSplit()); setMode('equal'); }
  };

  const switchMode = (m: SplitMode) => {
    if (m === mode) return;
    if (m === 'qty') {
      // при первом переключении раскидываем штуки поровну между отмеченными
      if (!Object.values(split).some((n) => n > 0)) setSplit(evenSplit(consumers.length ? consumers : members, qty));
    } else {
      setConsumers(fromSplit());
    }
    setMode(m);
  };

  const step = (pid: string, d: number) => setSplit({ ...split, [pid]: Math.max(0, (split[pid] || 0) + d) });

  const save = () => {
    if (!(priceNum > 0)) return ui.toast('Укажи цену');
    let data: Omit<Item, 'id'>;
    if (mode === 'qty') {
      const clean: Record<string, number> = {};
      members.forEach((m) => { if (split[m] > 0) clean[m] = split[m]; });
      const sum = Object.values(clean).reduce((s, n) => s + n, 0);
      if (sum !== qty) return ui.toast(`Распредели все ${qty} шт.: сейчас ${sum}`);
      data = { name: name.trim() || 'Позиция', price: priceNum, qty, splitMode: 'qty', split: clean, consumers: Object.keys(clean) };
    } else {
      data = { name: name.trim() || 'Позиция', price: priceNum, qty, splitMode: 'equal', split: {}, consumers: consumers.filter((m) => members.includes(m)) };
    }
    updateEvent(eventId, (e) => {
      const it = itemId ? e.items.find((i) => i.id === itemId) : undefined;
      if (it) Object.assign(it, data);
      else e.items.push({ id: uid(), ...data });
    });
    ui.close();
    ui.toast('Позиция сохранена');
  };

  const remove = () => {
    updateEvent(eventId, (e) => { e.items = e.items.filter((i) => i.id !== itemId); });
    ui.close();
    ui.toast('Позиция удалена');
  };

  return (
    <>
      <h4>{itemId ? 'Позиция' : 'Новая позиция'}</h4>
      <label className="field">
        <span>Название</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={texts.ph} />
      </label>
      <div className="two">
        <label className="field">
          <span>Цена за штуку</span>
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="field">
          <span>Количество</span>
          <input inputMode="numeric" value={qtyText} onChange={(e) => onQty(e.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>Как делим</span>
        {qty > 1 && (
          <div className="seg">
            <button type="button" aria-pressed={mode === 'equal'} onClick={() => switchMode('equal')}>Поровну</button>
            <button type="button" aria-pressed={mode === 'qty'} onClick={() => switchMode('qty')}>По штукам</button>
          </div>
        )}
        {mode === 'equal' ? (
          <>
            <p className="hint" style={{ margin: '0 0 10px' }}>{texts.who}: сумма разделится поровну</p>
            <PeopleChips ids={members} selected={consumers} onToggle={(pid) => setConsumers(toggleIn(consumers, pid))} />
          </>
        ) : (
          <>
            <div className="list split-list">
              {members.map((m) => (
                <div key={m} className="row">
                  <Av id={m} />
                  <div className="grow">
                    <div className="t">{nameOf(m)}</div>
                    <div className="s num">{split[m] ? money(priceNum * split[m], ev.currency) : '—'}</div>
                  </div>
                  <div className="stepper">
                    <button type="button" aria-label="Меньше" disabled={!(split[m] > 0)} onClick={() => step(m, -1)}>−</button>
                    <span className="num">{split[m] || 0}</span>
                    <button type="button" aria-label="Больше" disabled={left <= 0} onClick={() => step(m, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
            <p className={'hint split-left' + (left === 0 ? ' ok' : left < 0 ? ' bad' : '')}>
              {left > 0 ? `Осталось распределить: ${left} из ${qty}` : left < 0 ? `Распределено на ${-left} больше, чем ${qty} шт.` : `Все ${qty} шт. распределены ✓`}
            </p>
          </>
        )}
      </div>

      <div className="sheet-btns">
        {itemId && <button className="btn danger" onClick={remove}>Удалить</button>}
        <button className="btn primary" onClick={save}>Сохранить</button>
      </div>
    </>
  );
}
