import { useCallback, useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { addTicketQrs, listTicketQrs, removeTicketQr, type TicketQr } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { PhotoButtons } from './PhotoPick';
import { Icon } from './Icons';
import { PhotoViewer } from './PhotoViewer';

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

  // тот же просмотр, что у чеков: на весь экран, свайп и зум
  const view = (i: number) => {
    if (!list) return;
    ui.open(
      <PhotoViewer
        start={i}
        photos={list.map((q) => ({ key: q.name, url: q.url, title: 'QR для входа', caption: 'Прибавь яркость — сканер прочитает быстрее' }))}
        footer={(j) => (
          <div className="viewer-btns">
            <button
              className="viewer-btn"
              onClick={async () => {
                if (!confirm('Удалить этот QR-код?')) return;
                try { await removeTicketQr(crewId, ev.id, list[j].name); ui.close(); ui.toast('Удалено'); load(); } catch (e) { ui.toast(humanError(e)); }
              }}
            >{Icon.trash} Удалить</button>
            <button className="viewer-btn" onClick={openAdd}>{Icon.plus} Добавить</button>
          </div>
        )}
      />,
      { full: true },
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
