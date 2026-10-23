import { useState, type ReactNode } from 'react';
import type { Place } from '../lib/types';
import { CURRENCIES } from '../lib/format';
import { PlacePhoto } from './common';
import { Icon } from './Icons';

/** Поле-кнопка вместо системного списка: значение и стрелка › */
export function PickField({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      <button type="button" className="pick-field" onClick={onClick}>
        <span className="grow pick-val">{children}</span>
        <span className="pick-chev">{Icon.chev}</span>
      </button>
    </div>
  );
}

/** Заголовок выбора внутри шторки: ← назад */
function PickHead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <h4 className="pick-head">
      <button type="button" className="icon-btn sm" aria-label="Назад" onClick={onBack}>{Icon.back}</button>
      {title}
    </h4>
  );
}

/** Выбор места: свой порядок, фото, поиск, «Без места» и «+ Новое» */
export function PlacePicker({ title, places, value, onPick, onBack, onNew, newLabel }: {
  title: string;
  places: Place[];
  value: string;
  onPick: (id: string) => void;
  onBack: () => void;
  onNew: () => void;
  newLabel: string;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query ? places.filter((p) => (p.name + ' ' + p.address).toLowerCase().includes(query)) : places;

  return (
    <>
      <PickHead title={title} onBack={onBack} />
      {places.length > 6 && (
        <label className="field pick-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти по названию или адресу" autoComplete="off" />
        </label>
      )}
      <div className="list pick-list">
        {shown.map((p) => (
          <button key={p.id} type="button" className={'row' + (p.id === value ? ' picked' : '')} onClick={() => onPick(p.id)}>
            <PlacePhoto place={p} className="place-thumb" />
            <div className="grow">
              <div className="t">{p.name}</div>
              {p.address && <div className="s">{p.address}</div>}
            </div>
            {p.id === value && <span className="pick-check">{Icon.check}</span>}
          </button>
        ))}
        {query && !shown.length && <div className="empty">Ничего не нашлось</div>}
        {!query && !places.length && <div className="empty">Пока ни одного — добавь первое</div>}
        {!query && (
          <button type="button" className={'row' + (!value ? ' picked' : '')} onClick={() => onPick('')}>
            <span className="place-thumb pick-none">—</span>
            <div className="grow"><div className="t">Без места</div></div>
            {!value && <span className="pick-check">{Icon.check}</span>}
          </button>
        )}
      </div>
      <button type="button" className="btn block" style={{ marginTop: 12 }} onClick={onNew}>{Icon.plus} {newLabel}</button>
    </>
  );
}

/** Выбор валюты */
export function CurrencyPicker({ value, onPick, onBack, title = 'Валюта' }: {
  value: string;
  onPick: (code: string) => void;
  onBack?: () => void;
  title?: string;
}) {
  return (
    <>
      {onBack ? <PickHead title={title} onBack={onBack} /> : <h4>{title}</h4>}
      <div className="list pick-list">
        {CURRENCIES.map((c) => (
          <button key={c.code} type="button" className={'row' + (c.code === value ? ' picked' : '')} onClick={() => onPick(c.code)}>
            <div className="grow"><div className="t">{c.label}</div></div>
            <span className="s">{c.code}</span>
            {c.code === value && <span className="pick-check">{Icon.check}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

/** Подпись валюты для поля */
// eslint-disable-next-line react-refresh/only-export-components
export const currencyLabel = (code: string) => CURRENCIES.find((c) => c.code === code)?.label ?? code;
