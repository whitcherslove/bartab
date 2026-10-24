import { useCallback, useEffect, useState } from 'react';
import type { BarEvent } from '../lib/types';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { addTicketQrs, listTicketQrs, removeTicketQr, type TicketQr } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { PhotoButtons } from './PhotoPick';
import { Icon } from './Icons';
import { PhotoViewer, ViewerAsk } from './PhotoViewer';
import { done } from '../lib/motion';

const qrLists = new Map<string, TicketQr[]>();

/** QR-коды для входа в кино: просто картинки, видны всем участникам */
export function TicketQrBlock({ ev }: { ev: BarEvent }) {
  const { crewId } = useStore();
  const ui = useUI();
  // список QR встречи запоминаем — при повторном открытии видно сразу
  const [list, setListState] = useState<TicketQr[] | null>(() => qrLists.get(ev.id) ?? null);
  const setList = useCallback((l: TicketQr[]) => { qrLists.set(ev.id, l); setListState(l); }, [ev.id]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listTicketQrs(crewId, ev.id).then(setList).catch(() => setList([]));
  }, [crewId, ev.id, setList]);
  useEffect(() => { load(); }, [load]);

  const add = async (files: File[]) => {
    ui.close();
    setBusy(true);
    try {
      await addTicketQrs(crewId, ev.id, files);
      done();
      load();
    } catch (e) {
      ui.fail(humanError(e));
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
    ui.open(<QrViewer list={list} start={i} onDelete={(q) => removeTicketQr(crewId, ev.id, q.name)} onAdd={openAdd} onChanged={load} />, { full: true });
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

function QrViewer({ list, start, onDelete, onAdd, onChanged }: {
  list: TicketQr[]; start: number; onDelete: (q: TicketQr) => Promise<void>; onAdd: () => void; onChanged: () => void;
}) {
  const ui = useUI();
  const [asking, setAsking] = useState<TicketQr | null>(null);
  const [busy, setBusy] = useState(false);
  const clearAsk = useCallback(() => setAsking(null), []);

  const remove = async (q: TicketQr) => {
    setBusy(true);
    try { await onDelete(q); ui.close(); done(); onChanged(); } catch (e) { ui.fail(humanError(e)); setBusy(false); }
  };

  return (
    <PhotoViewer
      start={start}
      onIndex={clearAsk}
      photos={list.map((q) => ({ key: q.name, url: q.url, title: 'QR для входа', caption: 'Прибавь яркость — сканер прочитает быстрее' }))}
      footer={(j) => (
        <div className="viewer-btns">
          <button className="viewer-btn danger" disabled={busy} onClick={() => setAsking(list[j])}>{Icon.trash} Удалить</button>
          <button className="viewer-btn" onClick={onAdd}>{Icon.plus} Добавить</button>
        </div>
      )}
      overlay={asking && (
        <ViewerAsk key={asking.name} onClose={clearAsk}>
          <p className="viewer-ask-t">Удалить QR-код?</p>
          <p className="viewer-ask-s">Его перестанут видеть все участники встречи.</p>
          <button className="viewer-btn danger block" disabled={busy} onClick={() => remove(asking)}>Удалить QR-код</button>
        </ViewerAsk>
      )}
    />
  );
}
