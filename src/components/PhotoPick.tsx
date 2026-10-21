import type { ReactNode } from 'react';
import { useUI } from '../lib/ui';
import { Icon } from './Icons';

// На новых Android поле «выбрать фото» открывает только галерею.
// Поэтому даём две кнопки: камера (capture) и галерея (без capture).

type Props = {
  onFile: (file: File) => void;
  /** environment — основная камера (чек, бар), user — фронтальная (селфи) */
  facing?: 'environment' | 'user';
  cameraLabel?: string;
  galleryLabel?: string;
  className?: string;
  disabled?: boolean;
  /** выбрать несколько фото из галереи */
  onFiles?: (files: File[]) => void;
};

export function PhotoButtons({ onFile, onFiles, facing = 'environment', cameraLabel = 'Сфотографировать', galleryLabel = 'Из галереи', className = 'btn', disabled }: Props) {
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // чтобы можно было выбрать тот же файл ещё раз
    if (f) onFile(f);
  };
  return (
    <>
      <label className={className} aria-disabled={disabled}>
        {Icon.cam} {cameraLabel}
        <input type="file" accept="image/*" capture={facing} hidden disabled={disabled} onChange={pick} />
      </label>
      <label className={className} aria-disabled={disabled}>
        {Icon.image} {galleryLabel}
        <input
          type="file" accept="image/*" hidden disabled={disabled} multiple={!!onFiles}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (onFiles && list.length) onFiles(list); else if (list[0]) onFile(list[0]);
          }}
        />
      </label>
    </>
  );
}

/** Меню для аватарки: камера, галерея, убрать */
export function PhotoChoiceSheet({ title, facing = 'user', onFile, onRemove, extra }: {
  title: string;
  facing?: 'environment' | 'user';
  onFile: (file: File) => void;
  onRemove?: () => void;
  extra?: ReactNode;
}) {
  const ui = useUI();
  return (
    <>
      <h4>{title}</h4>
      {extra}
      <div className="photo-choice">
        <PhotoButtons facing={facing} className="btn block" onFile={(f) => { ui.close(); onFile(f); }} />
        {onRemove && <button className="btn block danger" onClick={() => { ui.close(); onRemove(); }}>Убрать фото</button>}
      </div>
    </>
  );
}
