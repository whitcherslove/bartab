import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { eventCategory } from '../lib/categories';
import { useUI } from '../lib/ui';
import { recognizeReceipt } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { PhotoButtons } from '../components/PhotoPick';

/** Сжимаем фото чека: по длинной стороне до 1600 px — текст читается, а файл лёгкий */
function compress(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Не удалось открыть фото'));
    img.src = URL.createObjectURL(file);
  });
}

export function ReceiptSheet({ eventId }: { eventId: string }) {
  const { crewId, sync, refresh, state } = useStore();
  const ev = state.events.find((e) => e.id === eventId);
  const tickets = eventCategory(ev, state.places) === 'cinema';
  const ui = useUI();
  const [stage, setStage] = useState<'pick' | 'upload' | 'scan'>('pick');
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState('');
  const alive = useRef(true); // шторку могли закрыть, пока идёт распознавание
  useEffect(() => () => { alive.current = false; }, []);

  const onFiles = async (files: File[]) => {
    if (!files.length) return;
    let added = 0, done = 0;
    try {
      await sync(); // встреча и участники должны уже лежать в базе
      for (let i = 0; i < files.length; i++) {
        setProgress(files.length > 1 ? ` ${i + 1} из ${files.length}` : '');
        setStage('upload');
        setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(files[i]); });
        const blob = await compress(files[i]);
        setStage('scan');
        const res = await recognizeReceipt(crewId, eventId, blob, tickets ? 'tickets' : 'receipt');
        added += res.count;
        done++;
      }
      await refresh();
      if (alive.current) ui.close();
      ui.toast(tickets ? `Билетов добавлено: ${added}` : done > 1 ? `Чеков: ${done}, позиций: ${added}` : `Чек распознан: ${added} поз.`);
    } catch (e) {
      await refresh();
      if (alive.current) setStage('pick');
      ui.fail(humanError(e));
    }
  };
  const onFile = (file?: File) => file && onFiles([file]);

  if (stage !== 'pick') {
    return (
      <div className="scan">
        {preview ? (
          <div className="scan-box" role="status" aria-label="Распознаю">
            <img src={preview} alt="" />
            <div className="scan-line" />
          </div>
        ) : (
          <div className="spinner" role="status" aria-label="Распознаю" />
        )}
        <b>{stage === 'upload' ? 'Загружаю фото' : tickets ? 'Распознаю билеты' : 'Распознаю чек'}{progress}…</b>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Обычно это 5–20 секунд. Шторку можно закрыть — позиции появятся сами.</span>
      </div>
    );
  }

  return (
    <>
      <h4>{tickets ? 'Цены из билетов' : 'Загрузить чек'}</h4>
      <p style={{ color: 'var(--muted)', margin: '-6px 0 16px', fontSize: 15 }}>
        {tickets
          ? 'Скриншот или фото билетов, где видны ряд, место и цена. Можно выбрать несколько скриншотов сразу — каждый билет станет отдельной позицией.'
          : 'Сфотографируй чек целиком и ровно, при хорошем свете. Можно выбрать несколько фото сразу — каждое станет отдельным чеком.'}
      </p>
      <div className="photo-choice">
        <PhotoButtons className="btn block" galleryLabel={tickets ? 'Скриншоты из галереи' : 'Выбрать из галереи'} onFile={onFile} onFiles={onFiles} />
      </div>
    </>
  );
}
