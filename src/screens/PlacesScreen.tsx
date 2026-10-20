import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { catOf, DEFAULT_CATEGORY, type Category } from '../lib/categories';
import { CategorySeg, Fab, PlacePhoto } from '../components/common';
import { PlaceSheet } from '../sheets/PlaceSheet';

const KEY = 'bartab-places-cat';

export function PlacesScreen() {
  const { state } = useStore();
  const ui = useUI();
  const [cat, setCatState] = useState<Category>(() => {
    try { return (localStorage.getItem(KEY) as Category) || DEFAULT_CATEGORY; } catch { return DEFAULT_CATEGORY; }
  });
  const setCat = (c: Category) => { setCatState(c); try { localStorage.setItem(KEY, c); } catch { /* ignore */ } };
  const list = state.places.filter((p) => (p.category || 'bar') === cat);
  const c = catOf(cat);

  return (
    <>
      <header className="top"><h1>Места</h1></header>
      <CategorySeg value={cat} onChange={setCat} />
      <div className="list">
        {list.length === 0 && <div className="empty">{c.emoji} Пока пусто — добавь первый {c.one.toLowerCase()}</div>}
        {list.map((p) => (
          <button key={p.id} className="row" onClick={() => ui.open(<PlaceSheet id={p.id} />)}>
            <PlacePhoto place={p} className="place-thumb" />
            <div className="grow">
              <div className="t">{p.name}</div>
              <div className="s">{p.address || 'Адрес не указан'}</div>
            </div>
            <span className="s">{state.events.filter((e) => e.placeId === p.id).length} раз</span>
          </button>
        ))}
      </div>
      <Fab label={c.one} onClick={() => ui.open(<PlaceSheet category={cat} />)} />
    </>
  );
}
