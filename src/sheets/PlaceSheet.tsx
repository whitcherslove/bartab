import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { hueOf, uid } from '../lib/format';
import { Icon } from '../components/Icons';
import { uploadPlacePhoto } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { photoStyle } from '../components/common';

/** Сжимаем фото на телефоне до 720 px по ширине */
function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 720 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function PlaceSheet({ id }: { id?: string }) {
  const { state, update, crewId } = useStore();
  const ui = useUI();
  const place = id ? state.places.find((p) => p.id === id) : undefined;
  const [name, setName] = useState(place?.name ?? '');
  const [address, setAddress] = useState(place?.address ?? '');
  const [photo, setPhoto] = useState(place?.photo ?? '');
  const [busy, setBusy] = useState(false);

  const onFile = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await resize(file)); } catch { ui.toast('Не удалось прочитать фото'); }
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return ui.toast('Укажи название');
    const placeId = id ?? uid();
    let url = photo;
    // новое фото (data:...) сначала загружаем в хранилище
    if (photo.startsWith('data:')) {
      setBusy(true);
      try {
        url = await uploadPlacePhoto(crewId, placeId, photo);
      } catch (e) {
        setBusy(false);
        return ui.toast('Фото не загрузилось: ' + humanError(e));
      }
    }
    update((d) => {
      const p = d.places.find((x) => x.id === placeId);
      if (p) Object.assign(p, { name: n, address: address.trim(), photo: url });
      else d.places.push({ id: placeId, name: n, address: address.trim(), photo: url, hue: hueOf(n) });
    });
    ui.close();
    ui.toast('Бар сохранён');
  };

  return (
    <>
      <h4>{id ? 'Бар' : 'Новый бар'}</h4>
      <div className="photo hero" style={{ height: 140, ...photoStyle({ name: name || 'Б', hue: place?.hue ?? hueOf(name || 'Б'), photo }) }} />
      <label className="btn block" style={{ cursor: 'pointer', marginBottom: 14 }}>
        {Icon.cam} {photo ? 'Заменить фото' : 'Добавить фото'}
        <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <label className="field"><span>Название</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Адрес</span><input value={address} onChange={(e) => setAddress(e.target.value)} /></label>
      <div className="sheet-btns"><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Загружаю фото…' : 'Сохранить'}</button></div>
    </>
  );
}
