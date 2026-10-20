import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { hueOf, uid } from '../lib/format';
import { Icon } from '../components/Icons';
import { photoStyle } from '../components/common';
import { MapButtons } from '../components/MapButtons';
import { CategorySeg } from '../components/common';
import { catOf, DEFAULT_CATEGORY, type Category } from '../lib/categories';
import { PhotoButtons } from '../components/PhotoPick';
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

export function PlaceSheet({ id, category: initialCat }: { id?: string; category?: Category }) {
  const { state, update, crewId } = useStore();
  const ui = useUI();
  const place = id ? state.places.find((p) => p.id === id) : undefined;
  const [name, setName] = useState(place?.name ?? '');
  const [category, setCategory] = useState<Category>(place?.category ?? initialCat ?? DEFAULT_CATEGORY);
  const [address, setAddress] = useState(place?.address ?? '');
  const [photo, setPhoto] = useState(place?.photo ?? '');
  const [mapUrl, setMapUrl] = useState(place?.mapUrl ?? '');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(place?.lat != null && place?.lon != null ? { lat: place.lat, lon: place.lon } : null);
  const [busy, setBusy] = useState(false);
  const [draftId] = useState(() => uid());
  const [editing, setEditing] = useState(!id);

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
        const res = await searchPlaces(q, near, ctrl.signal, category);
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
  }, [name, searchOn, category]);

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
    let data: string;
    try { data = await resize(file); } catch { return ui.toast('Не удалось прочитать фото'); }
    if (editing || !id) { setPhoto(data); return; }
    // просмотр: сразу загружаем и сохраняем
    setBusy(true);
    try {
      const url = await uploadPlacePhoto(crewId, id, data);
      setPhoto(url);
      update((d) => { const p = d.places.find((x) => x.id === id); if (p) p.photo = url; });
      ui.toast('Фото обновлено');
    } catch (e) {
      ui.toast('Фото не загрузилось: ' + humanError(e));
    }
    setBusy(false);
  };

  const removePhoto = () => {
    setPhoto('');
    if (!editing && id) update((d) => { const p = d.places.find((x) => x.id === id); if (p) p.photo = ''; });
  };

  const cancelEdit = () => {
    if (!place) return;
    setName(place.name); setAddress(place.address); setCategory(place.category ?? DEFAULT_CATEGORY);
    setMapUrl(place.mapUrl ?? ''); setCoords(place.lat != null && place.lon != null ? { lat: place.lat, lon: place.lon } : null);
    setPhoto(place.photo ?? ''); setSearchOn(false); setFound([]);
    setEditing(false);
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return ui.toast('Укажи название');
    const link = mapUrl.trim();
    const placeId = id ?? draftId;
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
    const data = { name: n, address: address.trim(), photo: url, mapUrl: link, lat: coords?.lat ?? null, lon: coords?.lon ?? null, category };
    update((d) => {
      const p = d.places.find((x) => x.id === placeId);
      if (p) Object.assign(p, data);
      else d.places.push({ id: placeId, hue: hueOf(n), ...data });
    });
    setBusy(false);
    if (id) { setEditing(false); setSearchOn(false); ui.toast('Сохранено'); return; }
    ui.close();
    ui.toast('Место сохранено');
  };

  const remove = () => {
    if (!id) return;
    const used = state.events.filter((e) => e.placeId === id).length;
    const msg = used ? `Удалить место? В ${used} встреч${used === 1 ? 'е' : 'ах'} пропадёт привязка к нему, остальное сохранится.` : 'Удалить место?';
    if (!confirm(msg)) return;
    update((d) => {
      d.places = d.places.filter((p) => p.id !== id);
      d.events.forEach((e) => { if (e.placeId === id) e.placeId = ''; });
    });
    ui.close();
    ui.toast('Место удалено');
  };

  const preview = { name: name || 'Б', address, mapUrl: mapUrl.trim(), lat: coords?.lat ?? null, lon: coords?.lon ?? null, category };

  return (
    <>
      <div className="photo hero place-cover" style={{ height: 190, ...photoStyle({ id: id ?? draftId, name: name || 'Б', hue: place?.hue ?? hueOf(name || 'Б'), photo, category }) }}>
        <div className="cover-actions">
          <PhotoButtons className="btn sm cover-btn" cameraLabel="Камера" galleryLabel="Галерея" onFile={onFile} />
          {photo && <button type="button" className="btn sm cover-btn" onClick={removePhoto} disabled={busy}>Убрать</button>}
        </div>
      </div>
      {id && !editing ? (
        <>
          <div className="place-head">
            <div className="grow">
              <h4 className="place-title">{name}</h4>
              <span className="place-cat">{catOf(category).emoji} {catOf(category).one}</span>
            </div>
            <button className="icon-btn" aria-label="Редактировать" onClick={() => setEditing(true)}>{Icon.edit}</button>
          </div>
          {address && <p className="place-addr">{address}</p>}
          {(coords || mapUrl.trim() || address.trim()) && <MapButtons place={{ id: '', hue: 0, photo: '', ...preview }} />}
          <p className="hint" style={{ margin: '14px 2px 0' }}>
            {(() => { const n = state.events.filter((e) => e.placeId === id).length; return n ? `Встреч здесь: ${n}` : 'Встреч здесь пока не было'; })()}
          </p>
        </>
      ) : (
        <>
      <h4>{id ? 'Редактирование' : category === 'bar' ? 'Новый бар' : category === 'shop' ? 'Новый магазин' : 'Новый кинотеатр'}</h4>
      <CategorySeg value={category} onChange={setCategory} one />

      <label className="field">
        <span>Название {searchOn && <small className="muted">— начни вводить, поищем рядом</small>}</span>
        <input value={name} onChange={(e) => { setName(e.target.value); if (!id) setSearchOn(true); }} placeholder={category === 'bar' ? 'Например, Хмель и Солод' : category === 'shop' ? 'Например, Перекрёсток' : 'Например, Аврора'} autoComplete="off" />
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


      <div className="sheet-btns">
        {id && <button className="btn" onClick={cancelEdit} disabled={busy}>Отмена</button>}
        <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>
      {id && <button className="btn block danger" style={{ marginTop: 10 }} onClick={remove} disabled={busy}>Удалить место</button>}
        </>
      )}
    </>
  );
}
