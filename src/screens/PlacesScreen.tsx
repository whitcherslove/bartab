import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { CATEGORIES, catOf, DEFAULT_CATEGORY, type Category } from '../lib/categories';
import { useSwipeTabs } from '../lib/swipe';
import { CategorySeg, Fab, PlacePhoto } from '../components/common';
import { PlaceSheet } from '../sheets/PlaceSheet';

const KEY = 'bartab-places-cat';

export function PlacesScreen() {
  const { state } = useStore();
  const ui = useUI();
  const [cat, setCatState] = useState<Category>(() => {
    try { const v = localStorage.getItem(KEY); return CATEGORIES.some((c) => c.id === v) ? (v as Category) : DEFAULT_CATEGORY; } catch { return DEFAULT_CATEGORY; }
  });
  const setCat = (c: Category) => { setCatState(c); try { localStorage.setItem(KEY, c); } catch { /* ignore */ } };
  const swipe = useSwipeTabs(CATEGORIES.map((c) => c.id), cat, setCat);
  const list = state.places.filter((p) => (p.category || 'bar') === cat);
  const c = catOf(cat);

  return (
    <>
      <header className="top"><h1>Места</h1></header>
      <CategorySeg value={cat} onChange={swipe.go} />
      <div className="swipe-area" {...swipe.bind}>
      <div className={'list ' + swipe.enterClass} key={cat}>
        {list.length === 0 && <div className="empty">{c.emoji} Пока пусто — {cat === 'bar' ? 'добавь первый бар' : cat === 'cinema' ? 'добавь первый кинотеатр' : 'добавь ресторан, доставку или что угодно'}</div>}
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
      </div>
      <Fab label={c.one} onClick={() => ui.open(<PlaceSheet category={cat} />)} />
    </>
  );
}
