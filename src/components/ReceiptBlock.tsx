import { useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useUI } from '../lib/ui';
import { deleteReceipt, receiptUrls } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Icon } from './Icons';
import { ReceiptSheet } from '../sheets/ReceiptSheet';
import { useStore } from '../lib/store';
import { eventCategory } from '../lib/categories';
import { plainStatus, receiptItems, receiptLabel, receiptLine, receiptsOf, receiptState, receiptsSummary, receiptsTitle } from '../lib/receipts';

/** Временные ссылки на фото; пока грузятся — пустые строки */
function useReceiptUrls(paths: string[]) {
  const key = paths.join('|');
  const [urls, setUrls] = useState<{ key: string; list: string[] }>({ key: '', list: [] });
  useEffect(() => {
    let alive = true;
    const list = key ? key.split('|') : [];
    receiptUrls(list.filter(Boolean))
      .then((signed) => {
        if (!alive) return;
        const byPath = new Map(list.filter(Boolean).map((p, i) => [p, signed[i]]));
        setUrls({ key, list: list.map((p) => byPath.get(p) ?? '') });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return urls.key === key ? urls.list : paths.map(() => '');
}

/** Блок чеков во встрече: большая кнопка загрузки или стопка чеков */
export function ReceiptBlock({ ev }: { ev: BarEvent }) {
  const ui = useUI();
  const { state } = useStore();
  const tickets = eventCategory(ev, state.places) === 'cinema';
  const list = receiptsOf(ev);
  const top = list.slice(-2); // в стопке видны два последних
  const urls = useReceiptUrls(top.map((r) => r.path));

  const upload = () => ui.open(<ReceiptSheet eventId={ev.id} />);

  if (!list.length) {
    return (
      <button className="receipt-cta" onClick={upload}>
        <span className="receipt-cta-ico">{Icon.cam}</span>
        <span className="grow">
          <b>{tickets ? 'Цены из билетов' : 'Загрузить чек'}</b>
          <span>{tickets ? 'Загрузи скриншоты билетов — места и цены станут позициями' : 'Сфотографируй — позиции добавятся сами'}</span>
        </span>
      </button>
    );
  }

  const all = () => ui.open(<ReceiptsSheet eventId={ev.id} />);
  const sum = receiptsSummary(ev);

  return (
    <div className="receipt-card">
      <button className={'receipt-stack' + (top.length > 1 ? ' many' : '')} onClick={all} aria-label={tickets ? 'Посмотреть билеты' : 'Посмотреть чеки'}>
        {top.map((r, i) => (
          <span key={r.id} className="rs-sheet">
            {urls[i] ? <img src={urls[i]} alt="" /> : <span className="receipt-thumb-ph">{Icon.cam}</span>}
          </span>
        ))}
        {list.length > 2 && <span className="rs-count num">{list.length}</span>}
      </button>
      <button className="receipt-info grow" onClick={all}>
        <span className="t">{receiptsTitle(ev, tickets)}</span>
        <span className={'s rs-' + sum.state}>{sum.text}</span>
      </button>
      <button className="btn sm ghost" onClick={upload}>Ещё</button>
    </div>
  );
}

/** Все чеки встречи */
function ReceiptsSheet({ eventId }: { eventId: string }) {
  const ui = useUI();
  const { state } = useStore();
  const ev = state.events.find((e) => e.id === eventId);
  const list = ev ? receiptsOf(ev) : [];
  const urls = useReceiptUrls(list.map((r) => r.path));
  if (!ev) return <div className="empty">Встреча не найдена</div>;
  const tickets = eventCategory(ev, state.places) === 'cinema';

  return (
    <>
      <h4>{tickets ? 'Билеты' : list.length > 1 ? 'Чеки' : 'Чек'}</h4>
      <div className="list">
        {list.map((r, i) => (
          <button key={r.id} className="row receipt-row" onClick={() => ui.open(<ReceiptView eventId={eventId} receiptId={r.id} />)}>
            <span className="receipt-thumb sm">{urls[i] ? <img src={urls[i]} alt="" /> : <span className="receipt-thumb-ph">{Icon.cam}</span>}</span>
            <div className="grow">
              <div className="t">{receiptLabel(ev, r)}</div>
              <div className={'s rs-' + receiptState(r)}>{receiptLine(ev, r)}</div>
            </div>
          </button>
        ))}
        {!list.length && <div className="empty">Чеков пока нет</div>}
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => ui.open(<ReceiptSheet eventId={eventId} />)}>
        {Icon.plus} {tickets ? 'Добавить скриншоты' : 'Добавить чек'}
      </button>
    </>
  );
}

/** Один чек: фото, статус, удаление */
function ReceiptView({ eventId, receiptId }: { eventId: string; receiptId: string }) {
  const ui = useUI();
  const { state, sync, refresh } = useStore();
  const ev = state.events.find((e) => e.id === eventId);
  const r = ev ? receiptsOf(ev).find((x) => x.id === receiptId) : undefined;
  const [url] = useReceiptUrls(r ? [r.path] : []);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ev || !r) return <div className="empty">Удалено</div>;

  const items = receiptItems(ev, r);
  const many = receiptsOf(ev).length > 1;
  const label = receiptLabel(ev, r);

  const remove = async (withItems: boolean) => {
    setBusy(true);
    try {
      await sync(); // сначала отправляем, что накопилось
      await deleteReceipt(ev.id, r, withItems);
      await refresh();
      if (many) ui.open(<ReceiptsSheet eventId={eventId} />);
      else ui.close();
      ui.toast(withItems && items.length ? `Удалено: ${label} и позиции (${items.length})` : `Удалено: ${label}`);
    } catch (e) {
      setBusy(false);
      ui.toast(humanError(e));
    }
  };

  return (
    <>
      <h4>
        {many && <button className="icon-btn sm sheet-back" aria-label="Все чеки" onClick={() => ui.open(<ReceiptsSheet eventId={eventId} />)}>{Icon.back}</button>}
        {label}
      </h4>
      {r.status && <p className={'receipt-status rs-' + receiptState(r)}>{plainStatus(r.status)}</p>}
      {url ? <img className="receipt-full" src={url} alt={label} /> : <div className="empty">Загружаю…</div>}
      {url && <a className="btn block" style={{ marginTop: 12 }} href={url} target="_blank" rel="noopener">Открыть в полном размере</a>}

      {!asking ? (
        <button
          className="btn block danger"
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={() => (items.length ? setAsking(true) : confirm(`Удалить «${label}»?`) && remove(false))}
        >
          Удалить
        </button>
      ) : (
        <div className="receipt-ask">
          <p>С этого фото пришло позиций: {items.length}. Удалить их тоже?</p>
          <button className="btn block danger" disabled={busy} onClick={() => remove(true)}>Удалить вместе с позициями</button>
          <button className="btn block" disabled={busy} onClick={() => remove(false)}>Только фото, позиции оставить</button>
          <button className="link-btn" disabled={busy} onClick={() => setAsking(false)}>Отмена</button>
        </div>
      )}
    </>
  );
}
