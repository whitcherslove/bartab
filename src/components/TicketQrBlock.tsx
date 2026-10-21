import { useCallback, useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { addTicketQrs, listTicketQrs, removeTicketQr, type TicketQr } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { PhotoButtons } from './PhotoPick';
import { Icon } from './Icons';

/** QR-коды для входа в кино: просто картинки, видны всем участникам */
export function TicketQrBlock({ ev }: { ev: BarEvent }) {
  const { crewId } = useStore();
  const ui = useUI();
  const [list, setList] = useState<TicketQr[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listTicketQrs(crewId, ev.id).then(setList).catch(() => setList([]));
  }, [crewId, ev.id]);
  useEffect(() => { load(); }, [load]);

  const add = async (files: File[]) => {
    ui.close();
    setBusy(true);
    try {
      await addTicketQrs(crewId, ev.id, files);
      ui.toast(files.length > 1 ? `QR-кодов добавлено: ${files.length}` : 'QR-код добавлен');
      load();
    } catch (e) {
      ui.toast(humanError(e));
    }
    setBusy(false);
  };

  const openAdd = () =>
    ui.open(
      <>
        <h4>QR для входа</h4>
        <p className="hint" style={{ margin: '-6px 0 16px' }}>Скриншоты билетов с QR-кодами. Ничего не распознаётся — их просто увидят все участники, чтобы показать на входе.</p>
        <div className="photo-choice">
          <PhotoButtons className="btn block" galleryLabel="Скриншоты из галереи" onFile={(f) => add([f])} onFiles={add} />
        </div>
      </>,
    );

  const view = (i: number) => {
    if (!list) return;
    const q = list[i];
    ui.open(
      <>
        <h4>Билет {list.length > 1 ? `${i + 1} из ${list.length}` : ''}</h4>
        <div className="qr-full"><img src={q.url} alt="QR-код билета" /></div>
        <p className="hint" style={{ textAlign: 'center', margin: '10px 0 12px' }}>Прибавь яркость экрана — так сканер на входе прочитает быстрее.</p>
        <div className="sheet-btns">
          {list.length > 1 && <button className="btn" onClick={() => view((i + 1) % list.length)}>Следующий</button>}
          <button
            className="btn danger"
            onClick={async () => {
              if (!confirm('Удалить этот QR-код?')) return;
              try { await removeTicketQr(crewId, ev.id, q.name); ui.close(); ui.toast('Удалено'); load(); } catch (e) { ui.toast(humanError(e)); }
            }}
          >Удалить</button>
        </div>
      </>,
    );
  };

  return (
    <>
      <h3><span>QR для входа</span><small>{list?.length ? `видят все участники` : ''}</small></h3>
      <div className="qr-grid">
        {(list ?? []).map((q, i) => (
          <button key={q.name} className="qr-thumb" onClick={() => view(i)} aria-label={`Открыть билет ${i + 1}`}>
            <img src={q.url} alt="" loading="lazy" />
          </button>
        ))}
        <button className="qr-thumb qr-add" onClick={openAdd} disabled={busy} aria-label="Добавить QR-коды">
          {busy ? <span className="spinner small" /> : <>{Icon.plus}<span>Добавить</span></>}
        </button>
      </div>
    </>
  );
}
