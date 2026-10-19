import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { hueOf, uid } from '../lib/format';
import { Icon } from '../components/Icons';
import { photoStyle } from '../components/common';
import { MapButtons } from '../components/MapButtons';
import { uploadPlacePhoto } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { locate, searchPlaces, type FoundPlace } from '../lib/maps';

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
  const [mapUrl, setMapUrl] = useState(place?.mapUrl ?? '');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(place?.lat != null && place?.lon != null ? { lat: place.lat, lon: place.lon } : null);
  const [busy, setBusy] = useState(false);

  // Поиск: включается, пока вводишь название нового бара
  const [searchOn, setSearchOn] = useState(!id);
  const [found, setFound] = useState<FoundPlace[]>([]);
  const [provider, setProvider] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = name.trim();
    if (!searchOn || q.length < 3) { setFound([]); setSearchErr(''); return; }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setSearching(true);
      setSearchErr('');
      try {
        const near = await locate();
        const res = await searchPlaces(q, near, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setFound(res.results);
          setProvider(res.provider);
          if (!res.results.length) setSearchErr('Ничего не нашлось — заполни адрес вручную');
        }
      } catch (e) {
        if (!ctrl.signal.aborted) { setFound([]); setSearchErr('Поиск сейчас недоступен — заполни поля вручную'); console.warn(e); }
      }
      if (!ctrl.signal.aborted) setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [name, searchOn]);

  const pick = (f: FoundPlace) => {
    setName(f.name);
    setAddress(f.address);
    setCoords(f.lat != null && f.lon != null ? { lat: f.lat, lon: f.lon } : null);
    if (f.mapUrl) setMapUrl(f.mapUrl);
    setSearchOn(false);
    setFound([]);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try { setPhoto(await resize(file)); } catch { ui.toast('Не удалось прочитать фото'); }
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return ui.toast('Укажи название');
    const link = mapUrl.trim();
    const placeId = id ?? uid();
    let url = photo;
    if (photo.startsWith('data:')) {
      setBusy(true);
      try {
        url = await uploadPlacePhoto(crewId, placeId, photo);
      } catch (e) {
        setBusy(false);
        return ui.toast('Фото не загрузилось: ' + humanError(e));
      }
    }
    const data = { name: n, address: address.trim(), photo: url, mapUrl: link, lat: coords?.lat ?? null, lon: coords?.lon ?? null };
    update((d) => {
      const p = d.places.find((x) => x.id === placeId);
      if (p) Object.assign(p, data);
      else d.places.push({ id: placeId, hue: hueOf(n), ...data });
    });
    ui.close();
    ui.toast('Бар сохранён');
  };

  const preview = { name: name || 'Б', address, mapUrl: mapUrl.trim(), lat: coords?.lat ?? null, lon: coords?.lon ?? null };

  return (
    <>
      <h4>{id ? 'Бар' : 'Новый бар'}</h4>

      <label className="field">
        <span>Название {searchOn && <small className="muted">— начни вводить, поищем рядом</small>}</span>
        <input value={name} onChange={(e) => { setName(e.target.value); if (!id) setSearchOn(true); }} placeholder="Например, Хмель и Солод" autoComplete="off" />
      </label>
      {searchOn && (searching || found.length > 0 || searchErr) && (
        <div className="list found-list">
          {searching && <div className="row"><div className="s">Ищу…</div></div>}
          {!searching && found.map((f) => (
            <button key={f.key} type="button" className="row" onClick={() => pick(f)}>
              {Icon.pin}
              <div className="grow">
                <div className="t">{f.name}</div>
                <div className="s">{[f.kind, f.address].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
          {!searching && searchErr && <div className="row"><div className="s">{searchErr}</div></div>}
          {!searching && (
            <div className="row found-foot">
              <span className="s">{found.length && provider ? `Нашёл: ${provider}` : ''}</span>
              <button type="button" className="link-btn" onClick={() => { setSearchOn(false); setFound([]); }}>Добавить вручную</button>
            </div>
          )}
        </div>
      )}
      {id && !searchOn && (
        <button type="button" className="link-btn" onClick={() => setSearchOn(true)}>Найти на карте заново</button>
      )}

      <label className="field"><span>Адрес</span><input value={address} onChange={(e) => { setAddress(e.target.value); setMapUrl(''); setCoords(null); }} /></label>

      {(coords || mapUrl.trim() || address.trim()) && name.trim() && (
        <div className="field"><span>Показать на карте</span><MapButtons place={{ id: '', hue: 0, photo: '', ...preview }} /></div>
      )}

      <div className="photo hero" style={{ height: 140, ...photoStyle({ name: name || 'Б', hue: place?.hue ?? hueOf(name || 'Б'), photo }) }} />
      <label className="btn block" style={{ cursor: 'pointer', marginBottom: 14 }}>
        {Icon.cam} {photo ? 'Заменить фото' : 'Добавить фото'}
        <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      <div className="sheet-btns"><button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Загружаю фото…' : 'Сохранить'}</button></div>
    </>
  );
}
