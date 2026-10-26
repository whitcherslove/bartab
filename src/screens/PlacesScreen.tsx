import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { useAccount } from '../lib/account';
import { humanError } from '../lib/supabase';
import { CATEGORIES, catOf, DEFAULT_CATEGORY, type Category } from '../lib/categories';
import { useSwipeTabs } from '../lib/swipe';
import { mergeOrder, moveItem, sortPlaces, withForeign } from '../lib/placeOrder';
import { done } from '../lib/motion';
import { CategorySeg, CrewAvatar, Fab, PlacePhoto } from '../components/common';
import { CrewPickerSheet } from '../sheets/CrewPickerSheet';
import { Icon } from '../components/Icons';
import { ReorderList } from '../components/ReorderList';
import { PlaceSheet } from '../sheets/PlaceSheet';
import type { Place } from '../lib/types';

const KEY = 'bartab-places-cat';

export function PlacesScreen() {
  const { state } = useStore();
  const ui = useUI();
  const acc = useAccount();
  const [cat, setCatState] = useState<Category>(() => {
    try { const v = localStorage.getItem(KEY); return CATEGORIES.some((c) => c.id === v) ? (v as Category) : DEFAULT_CATEGORY; } catch { return DEFAULT_CATEGORY; }
  });
  const setCat = (c: Category) => { setCatState(c); try { localStorage.setItem(KEY, c); } catch { /* ignore */ } };
  const swipe = useSwipeTabs(CATEGORIES.map((c) => c.id), cat, setCat);

  const order = acc.profile.place_order ?? [];
  const all = sortPlaces(state.places, order); // личный порядок
  const list = all.filter((p) => (p.category || 'bar') === cat);
  const c = catOf(cat);

  // режим «Порядок»: черновик текущей категории
  const [draft, setDraft] = useState<Place[] | null>(null);
  const editing = draft !== null;

  const commit = async (next: Place[] | null = draft) => {
    if (!next) return;
    const merged = mergeOrder(all.map((p) => p.id), next.map((p) => p.id));
    if (merged.join() === all.map((p) => p.id).join()) return;
    // места других компаний (их здесь не видно) сохраняют свой порядок
    const ids = withForeign(merged, all.map((p) => p.id), order);
    try { await acc.savePlaceOrder(ids); done(); } catch (e) { ui.fail(humanError(e)); }
  };
  const finish = () => { commit(); setDraft(null); };
  const changeCat = (next: Category) => {
    if (editing) {
      // переключили категорию в режиме порядка — сохраняем и расставляем следующую
      commit();
      setCat(next);
      setDraft(all.filter((p) => (p.category || 'bar') === next));
    } else swipe.go(next);
  };

  const info = (p: Place) => (
    <>
      <PlacePhoto place={p} className="place-thumb" />
      <div className="grow">
        <div className="t">{p.name}</div>
        {(p.address || p.category !== 'other') && <div className="s">{p.address || 'Адрес не указан'}</div>}
      </div>
    </>
  );

  return (
    <>
      <header className="top">
        <h1>Места</h1>
        {editing ? (
          <button className="btn sm primary" onClick={finish}>Готово</button>
        ) : (
          <>
            {list.length > 1 && (
              <button className="btn sm ghost head-btn" onClick={() => setDraft(list)} aria-label="Поменять порядок мест">{Icon.sort} Порядок</button>
            )}
            {/* та же кнопка компании, что на «Встречах»: места — только этой компании */}
            <button className="crew-btn" onClick={() => ui.open(<CrewPickerSheet />)} aria-label={`Компания «${acc.crew.name}» — сменить`}>
              <CrewAvatar crew={acc.crew} size={38} />
            </button>
          </>
        )}
      </header>
      <CategorySeg value={cat} onChange={changeCat} />

      {editing ? (
        <>
          <p className="hint reorder-hint">Тяни за ⠿, чтобы поменять порядок. Он только твой — у остальных свой.</p>
          {draft.length ? (
            <ReorderList items={draft} onMove={(from, to) => setDraft(moveItem(draft, from, to))} render={info} />
          ) : (
            <div className="list"><div className="empty">{c.emoji} Здесь пока пусто</div></div>
          )}
        </>
      ) : (
        <div className="swipe-area" {...swipe.bind}>
          <div className={'list ' + swipe.enterClass} key={cat}>
            {list.length === 0 && <div className="empty">{c.emoji} Пока пусто — {cat === 'bar' ? 'добавь первый бар' : cat === 'cinema' ? 'добавь первый кинотеатр' : 'добавь ресторан, доставку или что угодно'}</div>}
            {list.map((p) => (
              <button key={p.id} data-flash={p.id} className="row" onClick={() => ui.open(<PlaceSheet id={p.id} />)}>
                {info(p)}
                <span className="s">{state.events.filter((e) => e.placeId === p.id).length} раз</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!editing && <Fab label={c.one} onClick={() => ui.open(<PlaceSheet category={cat} />)} />}
    </>
  );
}
