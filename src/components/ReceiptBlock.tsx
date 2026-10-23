import { useCallback, useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useUI } from '../lib/ui';
import { done } from '../lib/motion';
import { deleteReceipt, receiptUrls } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Icon } from './Icons';
import { ReceiptSheet } from '../sheets/ReceiptSheet';
import { useStore } from '../lib/store';
import { eventCategory } from '../lib/categories';
import { plainStatus, receiptLine, receiptOwnItems, receiptsOf, receiptState, receiptsSummary, receiptsTitle } from '../lib/receipts';
import { PhotoViewer, ViewerAsk } from './PhotoViewer';

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
  const [asking, setAsking] = useState(''); // id чека, про который спрашиваем «удалить?»
  const [busy, setBusy] = useState(false);
  const clearAsk = useCallback(() => setAsking(''), [setAsking]);
  if (!ev || !list.length) return null;
  const tickets = eventCategory(ev, state.places) === 'cinema';
  const askR = list.find((r) => r.id === asking);

  const remove = async (withItems: boolean) => {
    if (!askR) return;
    const ids = withItems ? receiptOwnItems(ev, askR).map((it) => it.id) : [];
    setBusy(true);
    try {
      await sync(); // сначала отправляем, что накопилось
      await deleteReceipt(ev.id, askR, ids);
      await refresh();
      if (list.length === 1) ui.close();
      if (ids.length) ui.toast(`Удалено вместе с позициями: ${ids.length}`);
      else done();
    } catch (e) {
      ui.fail(humanError(e));
    }
    setAsking('');
    setBusy(false);
  };

  // вопрос «удалить позиции?» — всегда, даже если чек один
  const n = askR ? receiptOwnItems(ev, askR).length : 0;
  const what = askR?.kind === 'tickets' ? 'скриншот билетов' : 'чек';

  return (
    <PhotoViewer
      onIndex={clearAsk}
      photos={list.map((r, i) => ({
        key: r.id,
        url: urls[i],
        title: r.kind === 'tickets' ? 'Билеты' : 'Чек',
        caption: receiptState(r) === 'busy' ? plainStatus(r.status) : receiptLine(ev, r),
        tone: receiptState(r),
      }))}
      footer={(i) => (
        <div className="viewer-btns">
          <button className="viewer-btn danger" disabled={busy} onClick={() => setAsking(list[i].id)}>{Icon.trash} Удалить</button>
          <button className="viewer-btn" onClick={() => ui.open(<ReceiptSheet eventId={eventId} />)}>{Icon.plus} {tickets ? 'Ещё билеты' : 'Ещё чек'}</button>
        </div>
      )}
      overlay={askR && (
        <ViewerAsk key={askR.id} onClose={clearAsk}>
          <p className="viewer-ask-t">Удалить {what}?</p>
          <p className="viewer-ask-s">{n ? `С этого фото пришло позиций: ${n}. Удалить их тоже?` : 'Позиций с этого фото нет — удалится только фото.'}</p>
          {n > 0 && <button className="viewer-btn danger block" disabled={busy} onClick={() => remove(true)}>Удалить вместе с позициями ({n})</button>}
          <button className={'viewer-btn block' + (n ? '' : ' danger')} disabled={busy} onClick={() => remove(false)}>{n ? 'Только фото, позиции оставить' : 'Удалить фото'}</button>
        </ViewerAsk>
      )}
    />
  );
}
