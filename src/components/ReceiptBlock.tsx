import { useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useUI } from '../lib/ui';
import { deleteReceipt, receiptUrls } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Icon } from './Icons';
import { ReceiptSheet } from '../sheets/ReceiptSheet';
import { useStore } from '../lib/store';
import { eventCategory } from '../lib/categories';
import { plainStatus, receiptItems, receiptLine, receiptsOf, receiptState, receiptsSummary, receiptsTitle } from '../lib/receipts';
import { PhotoViewer } from './PhotoViewer';

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

  // тап — сразу фото: один чек или листание между всеми
  const all = () => ui.open(<ReceiptViewer eventId={ev.id} />, { full: true });
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

/** Чеки встречи на весь экран: листаются свайпом, удаляются с позициями или без */
function ReceiptViewer({ eventId }: { eventId: string }) {
  const ui = useUI();
  const { state, sync, refresh } = useStore();
  const ev = state.events.find((e) => e.id === eventId);
  const list = ev ? receiptsOf(ev) : [];
  const urls = useReceiptUrls(list.map((r) => r.path));
  const [asking, setAsking] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ev || !list.length) return null;
  const tickets = eventCategory(ev, state.places) === 'cinema';

  const remove = async (i: number, withItems: boolean) => {
    const r = list[i];
    const n = receiptItems(ev, r).length;
    setBusy(true);
    try {
      await sync(); // сначала отправляем, что накопилось
      await deleteReceipt(ev.id, r, withItems);
      await refresh();
      if (list.length === 1) ui.close();
      ui.toast(withItems && n ? `Удалено вместе с позициями (${n})` : 'Удалено');
    } catch (e) {
      ui.toast(humanError(e));
    }
    setAsking('');
    setBusy(false);
  };

  const footer = (i: number) => {
    const r = list[i];
    const n = receiptItems(ev, r).length;
    if (asking === r.id) {
      return (
        <div className="viewer-ask">
          <p>С этого фото пришло позиций: {n}. Удалить их тоже?</p>
          <button className="btn block danger" disabled={busy} onClick={() => remove(i, true)}>Удалить вместе с позициями</button>
          <button className="btn block" disabled={busy} onClick={() => remove(i, false)}>Только фото, позиции оставить</button>
          <button className="viewer-link" disabled={busy} onClick={() => setAsking('')}>Отмена</button>
        </div>
      );
    }
    return (
      <div className="viewer-btns">
        <button className="viewer-btn" disabled={busy} onClick={() => (n ? setAsking(r.id) : confirm('Удалить это фото?') && remove(i, false))}>
          {Icon.trash} Удалить
        </button>
        <button className="viewer-btn" onClick={() => ui.open(<ReceiptSheet eventId={eventId} />)}>
          {Icon.plus} {tickets ? 'Ещё билеты' : 'Ещё чек'}
        </button>
      </div>
    );
  };

  return (
    <PhotoViewer
      photos={list.map((r, i) => ({
        key: r.id,
        url: urls[i],
        title: r.kind === 'tickets' ? 'Билеты' : 'Чек',
        caption: receiptState(r) === 'busy' ? plainStatus(r.status) : receiptLine(ev, r),
        tone: receiptState(r),
      }))}
      footer={footer}
    />
  );
}
