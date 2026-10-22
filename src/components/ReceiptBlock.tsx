import { useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useUI } from '../lib/ui';
import { deleteReceipt, receiptUrl } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Icon } from './Icons';
import { ReceiptSheet } from '../sheets/ReceiptSheet';
import { useStore } from '../lib/store';
import { eventCategory } from '../lib/categories';

/** Блок чека во встрече: большая кнопка загрузки или миниатюра со статусом */
export function ReceiptBlock({ ev }: { ev: BarEvent }) {
  const ui = useUI();
  const [url, setUrl] = useState('');
  const { state, refresh } = useStore();
  const tickets = eventCategory(ev, state.places) === 'cinema';

  useEffect(() => {
    let alive = true;
    setUrl('');
    if (ev.receiptPath) receiptUrl(ev.receiptPath).then((u) => alive && setUrl(u)).catch(() => {});
    return () => { alive = false; };
  }, [ev.receiptPath]);

  const upload = () => ui.open(<ReceiptSheet eventId={ev.id} />);

  if (!ev.receiptPath) {
    return (
      <button className="receipt-cta" onClick={upload}>
        <span className="receipt-cta-ico">{Icon.cam}</span>
        <span className="grow">
          <b>{tickets ? 'Цены из билетов' : 'Загрузить чек'}</b>
          <span>{ev.status || (tickets ? 'Загрузи скриншоты билетов — места и цены станут позициями' : 'Сфотографируй — позиции добавятся сами')}</span>
        </span>
      </button>
    );
  }

  const remove = async () => {
    if (!confirm(`Удалить ${tickets ? 'скриншот билетов' : 'фото чека'}? Распознанные позиции останутся.`)) return;
    try {
      await deleteReceipt(ev.id, ev.receiptPath ?? '');
      await refresh();
      ui.close();
      ui.toast(tickets ? 'Скриншот удалён' : 'Чек удалён');
    } catch (e) {
      ui.toast(humanError(e));
    }
  };

  const view = () =>
    ui.open(
      <>
        <h4>{tickets ? 'Билеты' : 'Чек'}</h4>
        {url ? <img className="receipt-full" src={url} alt={tickets ? 'Билеты' : 'Фото чека'} /> : <div className="empty">Загружаю…</div>}
        <div className="sheet-btns" style={{ marginTop: 12 }}>
          {url && <a className="btn" href={url} target="_blank" rel="noopener">Открыть в полном размере</a>}
          <button className="btn primary" onClick={upload}>{tickets ? 'Добавить ещё' : 'Загрузить другой'}</button>
        </div>
        <button className="btn block danger" style={{ marginTop: 10 }} onClick={remove}>{tickets ? 'Удалить скриншот' : 'Удалить чек'}</button>
      </>,
    );

  return (
    <div className="receipt-card">
      <button className="receipt-thumb" onClick={view} aria-label="Посмотреть чек">
        {url ? <img src={url} alt="" /> : <span className="receipt-thumb-ph">{Icon.cam}</span>}
      </button>
      <div className="grow">
        <div className="t">{tickets ? 'Билеты' : 'Чек'}</div>
        <div className="s">{ev.status || 'Нажми на фото, чтобы посмотреть'}</div>
      </div>
      <button className="btn sm ghost" onClick={upload}>{tickets ? 'Ещё' : 'Другой'}</button>
    </div>
  );
}
