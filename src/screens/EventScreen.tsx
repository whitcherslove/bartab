import { useState } from 'react';
import type { BarEvent, TipsMode } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { evTotal, evWithTips, itemTotal, stats, tipAmount } from '../lib/calc';
import { fdate, money, parseNum } from '../lib/format';
import { Icon } from '../components/Icons';
import { Av, PlacePhoto } from '../components/common';
import { MapButtons } from '../components/MapButtons';
import { EventSheet } from '../sheets/EventSheet';
import { ItemSheet } from '../sheets/ItemSheet';
import { MemberSheet } from '../sheets/MemberSheet';
import { ReceiptBlock } from '../components/ReceiptBlock';
import { ChatSheet } from '../sheets/ChatSheet';

export function EventScreen({ id }: { id: string }) {
  const { state, updateEvent, nameOf } = useStore();
  const ui = useUI();
  const ev = state.events.find((e) => e.id === id);

  if (!ev) {
    return (
      <div className="empty">
        Встреча не найдена.<br /><br />
        <button className="btn" onClick={() => ui.back()}>К списку</button>
      </div>
    );
  }

  const place = state.places.find((p) => p.id === ev.placeId);
  const payer = ev.payer;
  const debtors = payer ? ev.members.filter((m) => m !== payer) : [];
  const doneCount = debtors.filter((m) => ev.settled.includes(m)).length;
  const unassigned = ev.items.filter((it) => !it.consumers.length).length;

  const setPayer = (pid: string) =>
    updateEvent(id, (e) => {
      e.payer = e.payer === pid ? '' : pid;
      e.settled = e.settled.filter((m) => m !== e.payer);
    });

  const clearItems = () => {
    if (!confirm(`Удалить все позиции (${ev.items.length})? Отменить будет нельзя.`)) return;
    updateEvent(id, (e) => { e.items = []; e.status = ''; });
    ui.toast('Позиции удалены');
  };

  const toggleSettled = (pid: string) => {
    const was = ev.settled.includes(pid);
    updateEvent(id, (e) => {
      e.settled = was ? e.settled.filter((m) => m !== pid) : [...e.settled, pid];
    });
    ui.toast(was ? `${nameOf(pid)}: отметка снята` : `${nameOf(pid)}: перевод отмечен ✅`);
  };

  return (
    <>
      <header className="top">
        <button className="icon-btn" aria-label="Назад" onClick={() => ui.back()}>{Icon.back}</button>
        <div style={{ flex: 1 }} />
        <button className="icon-btn" aria-label="Изменить встречу" onClick={() => ui.open(<EventSheet id={id} />)}>{Icon.edit}</button>
      </header>

      <PlacePhoto place={place} className="hero">
        <div className="hero-txt">
          <h2>{place?.name ?? 'Без места'}</h2>
          {place?.address && <div>{place.address}</div>}
        </div>
      </PlacePhoto>
      <div className="event-meta">
        <span className="date-chip">{Icon.calendar} {fdate(ev.date)}</span>
        {place && <MapButtons place={place} />}
      </div>

      {place?.category && place.category !== 'bar' ? (
        <div className="totals2">
          <div className="total-main"><b className="num">{money(evTotal(ev), ev.currency)}</b><span>всего</span></div>
        </div>
      ) : (<>
      <div className="totals2">
        <div className="total-main"><b className="num">{money(evWithTips(ev), ev.currency)}</b><span>всего</span></div>
        <div className="total-sub num">
          по чеку {money(evTotal(ev), ev.currency)}<br />
          чаевые {money(tipAmount(ev), ev.currency)}{ev.tipsMode === 'pct' && ev.tips ? ` (${ev.tips}%)` : ''}
        </div>
      </div>
      <TipsCard key={ev.id} ev={ev} />
      </>)}

      <ReceiptBlock ev={ev} />

      <h3>Плательщик <small>кто заплатил по счёту</small></h3>
      <div className="chips">
        {ev.members.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={m === payer} onClick={() => setPayer(m)}>
            <Av id={m} sm />{nameOf(m)}
          </button>
        ))}
      </div>
      {!payer && <p className="hint">Отметь, кто заплатил по счёту, — и посчитаем, сколько переводят остальные</p>}

      <h3>
        <span>Кто сколько <small>нажми на человека</small></span>
        <button className="link-btn add-link" onClick={() => ui.open(<ChatSheet eventId={id} />)}>{Icon.send} В чат</button>
      </h3>
      <div className="coasters">
        {ev.members.length === 0 && <div className="empty">Добавь участников через «Изменить»</div>}
        {ev.members.map((m) => {
          const st = stats(ev, m);
          // подпись сверху и сумма снизу — вместо «+» и «−»
          let cls = 'zero', cap = 'часть', val = money(st.owed, ev.currency);
          if (payer) {
            if (st.isPayer) {
              if (st.balance > 1) { cls = 'pos'; cap = 'ждёт'; val = money(st.balance, ev.currency); }
              else { cls = 'pos'; cap = 'оплачено'; val = '✓'; }
            } else if (st.settled || st.owed < 1) {
              cap = st.settled ? 'переведено' : 'в расчёте'; val = '✓';
            } else {
              cls = 'neg'; cap = 'к переводу'; val = money(st.owed, ev.currency);
            }
          }
          return (
            <button key={m} className={'coaster ' + cls} onClick={() => ui.open(<MemberSheet eventId={id} pid={m} />)}>
              <span className="mat num"><small>{cap}</small>{val}</span>
              <span className="nm">{nameOf(m)}</span>
            </button>
          );
        })}
      </div>

      {payer && (
        <>
          <h3>
            <span className="transfers-title">Переводы → <Av id={payer} sm /> {nameOf(payer)}</span>
            <small>{doneCount} из {debtors.length}</small>
          </h3>
          <div className="list">
            {debtors.length === 0 && <div className="empty">Больше никого нет</div>}
            {debtors.map((m) => {
              const st = stats(ev, m);
              return (
                <div key={m} className={'row' + (st.settled ? ' done' : '')}>
                  <Av id={m} />
                  <div className="grow"><div className="t">{nameOf(m)}</div><div className="s">{st.settled ? 'переведено' : 'ещё не переведено'}</div></div>
                  <span className="amt num">{money(st.owed, ev.currency)}</span>
                  <button className={'btn sm ' + (st.settled ? 'undo' : 'ghost')} onClick={() => toggleSettled(m)}>
                    {st.settled ? 'Отменить' : 'Готово'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h3>
        <span>Позиции <small>{ev.items.length}</small></span>
        {ev.items.length > 1 && <button className="link-btn danger-link" onClick={clearItems}>Удалить все</button>}
      </h3>
      {unassigned > 0 && <div className="warn">{unassigned} поз. ни на кого не разбиты: они не попадают в расчёт</div>}
      <div className="list">
        {ev.items.length === 0 && <div className="empty">Добавь позиции вручную или загрузи чек</div>}
        {ev.items.map((it) => (
          <button key={it.id} className="row" onClick={() => ui.open(<ItemSheet eventId={id} itemId={it.id} />)}>
            <div className="grow">
              <div className="t">{it.name}</div>
              <div className="s num">
                {it.qty} × {money(it.price, ev.currency)}{' '}
                {it.splitMode === 'qty' ? (
                  <span>{it.consumers.map((c) => `${nameOf(c)} ${it.split[c] || 0}`).join(', ')}</span>
                ) : (
                  <span className="avs">{it.consumers.map((c) => <Av key={c} id={c} sm />)}</span>
                )}
                {!it.consumers.length && <span style={{ color: 'var(--amber)' }}>ни на кого</span>}
              </div>
            </div>
            <span className="amt num">{money(itemTotal(it), ev.currency)}</span>
          </button>
        ))}
      </div>

      <div className="actbar">
        <div className="actbar-in">
          <button className="btn primary" onClick={() => ui.open(<ItemSheet eventId={id} />)}>{Icon.plus} Позиция</button>
        </div>
      </div>
    </>
  );
}

/** Чаевые прямо в карточке: сумма или процент */
function TipsCard({ ev }: { ev: BarEvent }) {
  const { updateEvent } = useStore();
  const [text, setText] = useState(ev.tips ? String(ev.tips) : '');

  const onChange = (v: string) => {
    setText(v);
    updateEvent(ev.id, (e) => { e.tips = parseNum(v); });
  };

  // При смене режима сумма чаевых сохраняется: 400 при счёте 4000 станет 10%
  const onMode = (m: TipsMode) => {
    if (m === ev.tipsMode) return;
    const total = evTotal(ev);
    const amount = tipAmount(ev);
    const next = m === 'pct' ? (total > 0 ? Math.round((amount / total) * 1000) / 10 : 0) : Math.round(amount);
    setText(next ? String(next) : '');
    updateEvent(ev.id, (e) => { e.tips = next; e.tipsMode = m; });
  };

  return (
    <div className="tips-card">
      <span className="tips-lbl">Чаевые</span>
      <div className="seg">
        <button type="button" aria-pressed={ev.tipsMode !== 'pct'} onClick={() => onMode('sum')}>Сумма</button>
        <button type="button" aria-pressed={ev.tipsMode === 'pct'} onClick={() => onMode('pct')}>%</button>
      </div>
      <input inputMode="decimal" placeholder="0" value={text} onChange={(e) => onChange(e.target.value)} aria-label="Чаевые" />
    </div>
  );
}
