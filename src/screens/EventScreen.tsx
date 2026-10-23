import { useEffect, useRef, useState } from 'react';
import type { BarEvent, TipsMode } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { evTotal, evWithTips, itemTotal, stats, tipAmount } from '../lib/calc';
import { badgeClass, dateBadge, fdate, money, parseNum } from '../lib/format';
import { Icon } from '../components/Icons';
import { Av, coverPlace, PlacePhoto } from '../components/common';
import { MapButtons } from '../components/MapButtons';
import { EventSheet } from '../sheets/EventSheet';
import { ItemSheet } from '../sheets/ItemSheet';
import { MemberSheet } from '../sheets/MemberSheet';
import { ReceiptBlock } from '../components/ReceiptBlock';
import { eventCategory } from '../lib/categories';
import { confetti, useFlip } from '../lib/motion';
import { TicketQrBlock } from '../components/TicketQrBlock';
import { ChatSheet } from '../sheets/ChatSheet';

export function EventScreen({ id }: { id: string }) {
  const { state, updateEvent, nameOf } = useStore();
  const ui = useUI();
  const ev = state.events.find((e) => e.id === id);
  const coastersRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const [showDone, setShowDone] = useState(false);
  const orderKey = ev ? `${ev.payer}|${ev.settled.join(',')}|${ev.members.join(',')}` : '';
  useFlip(coastersRef, orderKey);
  // салют, когда в этой сессии отмечен последний перевод
  const pendingCount = ev && ev.payer ? ev.members.filter((m) => m !== ev.payer && !ev.settled.includes(m) && stats(ev, m).owed >= 1).length : -1;
  const prevPending = useRef(pendingCount);
  useEffect(() => {
    if (prevPending.current > 0 && pendingCount === 0) setTimeout(() => confetti(doneRef.current), 60);
    prevPending.current = pendingCount;
  }, [pendingCount]);


  if (!ev) {
    return (
      <div className="empty">
        Встреча не найдена.<br /><br />
        <button className="btn" onClick={() => ui.back()}>К списку</button>
      </div>
    );
  }

  const place = state.places.find((p) => p.id === ev.placeId);
  const cat = eventCategory(ev, state.places);
  const payer = ev.payer;
  const debtors = payer ? ev.members.filter((m) => m !== payer) : [];
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

      <PlacePhoto place={coverPlace(place, ev)} className="hero">
        {dateBadge(ev.date) && <span className={badgeClass(dateBadge(ev.date))}>{dateBadge(ev.date)}</span>}
        <div className="hero-txt">
          <h2>{place?.name ?? 'Без места'}</h2>
          {place?.address && <div>{place.address}</div>}
        </div>
      </PlacePhoto>
      {(() => {
        const session = cat === 'cinema' && (ev.film || ev.sessionTime || ev.hall);
        return (
          <>
            {session && (
              <div className="session-card">
                <span className="session-ico" aria-hidden="true">🎬</span>
                <div className="grow">
                  <div className="session-film">{ev.film || 'Сеанс'}</div>
                  <div className="session-meta">{[fdate(ev.date), ev.sessionTime, ev.hall].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            )}
            <div className="event-meta">
              {!session && <span className="date-chip">{Icon.calendar} {fdate(ev.date)}</span>}
              {place && <MapButtons place={place} />}
            </div>
          </>
        );
      })()}

      {cat === 'cinema' ? (
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
      {cat === 'cinema' && <TicketQrBlock ev={ev} />}

      <h3>Кто заплатил</h3>
      <div className="chips">
        {ev.members.map((m) => (
          <button key={m} type="button" className="chip" aria-pressed={m === payer} onClick={() => setPayer(m)}>
            <Av id={m} sm />{nameOf(m)}
          </button>
        ))}
      </div>
      {!payer && <p className="hint">Отметь — и посчитаем, сколько переводят остальные</p>}

      <h3>
        <span>Кто сколько <small>нажми на человека</small></span>
        <button className="link-btn add-link" onClick={() => ui.open(<ChatSheet eventId={id} />)}>{Icon.send} В чат</button>
      </h3>
      <div className="coasters" ref={coastersRef}>
        {ev.members.length === 0 && <div className="empty">Добавь участников через «Изменить»</div>}
        {[...ev.members].sort((a, b) => {
          // плательщик первым, потом те, кому нужно перевести, «переведено» и «в расчёте» — вправо
          const rank = (m: string) => { if (!payer) return 0; const st = stats(ev, m); if (st.isPayer) return 0; return !st.settled && st.owed >= 1 ? 1 : 2; };
          return rank(a) - rank(b);
        }).map((m) => {
          const st = stats(ev, m);
          // подпись сверху и сумма снизу — вместо «+» и «−»
          let cls = 'zero', cap = 'часть', val = money(st.owed, ev.currency);
          if (payer) {
            if (st.isPayer) {
              if (st.balance > 1) { cls = 'pos'; cap = 'ждёт'; val = money(st.balance, ev.currency); }
              else { cls = 'pos'; cap = 'оплачено'; val = money(evWithTips(ev), ev.currency); } // весь счёт
            } else if (st.settled || st.owed < 1) {
              if (st.settled && st.owed >= 1) { cap = 'переведено'; val = money(st.owed, ev.currency); }
              else { cap = 'в расчёте'; val = '✓'; }
            } else {
              cls = 'neg'; cap = 'к переводу'; val = money(st.owed, ev.currency);
            }
          }
          return (
            <button key={m} data-flip={m} className={'coaster ' + cls} onClick={() => ui.open(<MemberSheet eventId={id} pid={m} />)}>
              <span className="mat num"><small>{cap}</small>{val}</span>
              <span className="nm">{nameOf(m)}</span>
            </button>
          );
        })}
      </div>

      {payer && (() => {
        // переводят только те, у кого есть что переводить
        const due = debtors.filter((m) => stats(ev, m).owed >= 1);
        const pending = due.filter((m) => !ev.settled.includes(m));
        if (!due.length) return null;
        // все рассчитались — одна строка, переводы раскрываются по тапу
        if (!pending.length) {
          return (
            <div className={'all-done' + (showDone ? ' open' : '')} ref={doneRef}>
              <button className="all-done-row" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                <span className="done-ico" aria-hidden="true">{Icon.check}</span>
                <span className="grow">Все рассчитались</span>
                <span className="done-more">Переводы <span className="done-caret">{Icon.down}</span></span>
              </button>
              {showDone && (
                <div className="done-list">
                  {due.map((m) => (
                    <button key={m} className="done-item" onClick={() => toggleSettled(m)} aria-label={`Снять отметку: ${nameOf(m)}`}>
                      <Av id={m} sm />
                      <span className="pc-name">{nameOf(m)}</span>
                      <span className="done-arrow">→ {nameOf(payer)}</span>
                      <span className="pc-amt num">{money(stats(ev, m).owed, ev.currency)}</span>
                    </button>
                  ))}
                  <p className="hint done-hint">Тап по человеку — снять отметку</p>
                </div>
              )}
            </div>
          );
        }
        return (
          <>
            <h3>
              <span className="transfers-title">Переводы → <Av id={payer} sm /> {nameOf(payer)}</span>
              <small>{due.length - pending.length} из {due.length}</small>
            </h3>
            <div className="pending-chips">
              {pending.map((m) => (
                <button key={m} className="pending-chip" onClick={() => toggleSettled(m)} aria-label={`Отметить перевод: ${nameOf(m)}`}>
                  <Av id={m} sm />
                  <span className="pc-name">{nameOf(m)}</span>
                  <span className="pc-amt num">{money(stats(ev, m).owed, ev.currency)}</span>
                  <span className="pc-check" aria-hidden="true">✓</span>
                </button>
              ))}
            </div>
            <p className="hint pending-hint">Тап по человеку — перевод отмечен. Отменить — через его подставку выше.</p>
          </>
        );
      })()}

      <h3>
        <span>Позиции <small>{ev.items.length}{unassigned > 0 && <span className="unassigned"> · без людей: {unassigned}</span>}</small></span>
        {ev.items.length > 1 && <button className="link-btn danger-link" onClick={clearItems}>Удалить все</button>}
      </h3>
      <div className="list">
        {ev.items.length === 0 && <div className="empty">Добавь позиции вручную или загрузи чек</div>}
        {ev.items.map((it) => {
          const mine = it.splitMode === 'qty' ? (it.split[state.me] || 0) > 0 : it.consumers.includes(state.me);
          const toggleMine = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (it.splitMode === 'qty') return ui.open(<ItemSheet eventId={id} itemId={it.id} />); // сколько штук — в позиции
            updateEvent(id, (ev2) => {
              const x = ev2.items.find((i) => i.id === it.id);
              if (!x) return;
              x.consumers = x.consumers.includes(state.me) ? x.consumers.filter((c) => c !== state.me) : [...x.consumers, state.me];
            });
          };
          return (
          <div key={it.id} className={'row item-row' + (it.consumers.length ? '' : ' no-people')} role="button" tabIndex={0} onClick={() => ui.open(<ItemSheet eventId={id} itemId={it.id} />)}>
            <div className="grow">
              <div className="t">{it.name}</div>
              <div className="s num">
                {it.qty} × {money(it.price, ev.currency)}{' '}
                {it.splitMode === 'qty' ? (
                  <span>{it.consumers.map((c) => `${nameOf(c)} ${it.split[c] || 0}`).join(', ')}</span>
                ) : (
                  <span className="avs">{it.consumers.map((c) => <Av key={c} id={c} sm />)}</span>
                )}
                {!it.consumers.length && <span className="unassigned">ни на кого</span>}
              </div>
            </div>
            <span className="amt num">{money(itemTotal(it), ev.currency)}</span>
            {ev.members.includes(state.me) && (
              <button className={'mine-btn' + (mine ? ' on' : '')} aria-pressed={mine} onClick={toggleMine} aria-label={mine ? 'Убрать себя из позиции' : 'Это моё'}>
                {mine ? '✓ Моё' : 'Моё'}
              </button>
            )}
          </div>
          );
        })}
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
