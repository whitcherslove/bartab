import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
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
  const { crewId, sync, refresh } = useStore();
  const ui = useUI();
  const [stage, setStage] = useState<'pick' | 'upload' | 'scan'>('pick');
  const alive = useRef(true); // шторку могли закрыть, пока идёт распознавание
  useEffect(() => () => { alive.current = false; }, []);

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      setStage('upload');
      const blob = await compress(file);
      await sync(); // посиделка и участники должны уже лежать в базе
      setStage('scan');
      const res = await recognizeReceipt(crewId, eventId, blob);
      await refresh();
      if (alive.current) ui.close();
      ui.toast(res.status.startsWith('⚠️') ? 'Чек распознан, но сумма не сходится — проверь позиции' : `Чек распознан: ${res.count} поз.`);
    } catch (e) {
      await refresh();
      if (alive.current) setStage('pick');
      ui.toast(humanError(e));
    }
  };

  if (stage !== 'pick') {
    return (
      <div className="scan">
        <div className="spinner" role="status" aria-label="Распознаю" />
        <b>{stage === 'upload' ? 'Загружаю фото…' : 'Распознаю чек…'}</b>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>Обычно это 5–20 секунд. Шторку можно закрыть — позиции появятся сами.</span>
      </div>
    );
  }

  return (
    <>
      <h4>Загрузить чек</h4>
      <p style={{ color: 'var(--muted)', margin: '-6px 0 16px', fontSize: 15 }}>
        Сфотографируй чек целиком и ровно, при хорошем свете. Позиции добавятся сами, останется отметить, кто что пил.
      </p>
      <div className="photo-choice">
        <PhotoButtons className="btn block" galleryLabel="Выбрать из галереи" onFile={onFile} />
      </div>
    </>
  );
}
