import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { humanError } from '../lib/supabase';
import { placeLinks, setPlaceLink, type PlaceLink } from '../lib/remote';
import { plural } from '../lib/receipts';
import { done } from '../lib/motion';
import { CrewAvatar } from './common';
import { Icon } from './Icons';

/**
 * Блок «Компании» в карточке места: в каких моих компаниях оно видно.
 * Отвязать нельзя, пока в компании есть встречи с этим местом — там замочек.
 */
// число встреч по компаниям — запоминаем, чтобы при повторном открытии было сразу
const linkCache = new Map<string, PlaceLink[]>();

export function PlaceCrews({ placeId }: { placeId: string }) {
  const acc = useAccount();
  const ui = useUI();
  const { state, refresh } = useStore();
  const place = state.places.find((p) => p.id === placeId);
  const [fetched, setFetched] = useState<PlaceLink[] | null>(() => linkCache.get(placeId) ?? null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    placeLinks(placeId)
      .then((l) => { linkCache.set(placeId, l); if (alive) setFetched(l); })
      .catch(() => {});
    return () => { alive = false; };
  }, [placeId]);

  // сразу — из загруженных данных (галочки), число встреч и замочки догружаются без сдвигов
  const known = place?.crewIds;
  const links: PlaceLink[] | null = fetched ?? (known
    ? acc.crews.map((c) => ({ crewId: c.id, linked: known.includes(c.id), events: c.id === acc.crew.id ? state.events.filter((e) => e.placeId === placeId).length : 0 }))
    : null);
  const setLinks = (fn: (cur: PlaceLink[] | null) => PlaceLink[] | null) => {
    const next = fn(links);
    if (next) linkCache.set(placeId, next);
    setFetched(next);
  };

  // одна компания или миграция ещё не запущена — блок не нужен
  if (acc.crews.length < 2 || !links?.length) return null;

  const toggle = async (l: PlaceLink) => {
    if (l.linked && l.events > 0) {
      ui.fail(`В этой компании ${l.events} ${plural(l.events, 'встреча', 'встречи', 'встреч')} с этим местом — отвязать нельзя`);
      return;
    }
    if (l.linked && links.filter((x) => x.linked).length === 1) {
      ui.fail('Место должно быть хотя бы в одной компании — проще удалить его');
      return;
    }
    setBusy(l.crewId);
    try {
      await setPlaceLink(placeId, l.crewId, !l.linked);
      setLinks((cur) => cur?.map((x) => (x.crewId === l.crewId ? { ...x, linked: !l.linked } : x)) ?? cur);
      done();
      if (l.crewId === acc.crew.id) {
        // убрали из текущей компании — здесь его больше нет
        ui.close();
        await refresh();
      }
    } catch (e) {
      ui.fail(humanError(e));
    }
    setBusy('');
  };

  return (
    <div className="place-crews">
      <h3>Компании <small>где видно это место</small></h3>
      <div className="crew-chips">
        {acc.crews.map((c) => {
          const l = links.find((x) => x.crewId === c.id);
          if (!l) return null;
          const locked = l.linked && l.events > 0;
          return (
            <button
              key={c.id}
              className={'crew-chip' + (l.linked ? ' on' : '') + (locked ? ' locked' : '')}
              disabled={busy === c.id}
              onClick={() => toggle(l)}
              aria-pressed={l.linked}
              title={locked ? `${l.events} ${plural(l.events, 'встреча', 'встречи', 'встреч')} — отвязать нельзя` : undefined}
            >
              <CrewAvatar crew={c} size={30} />
              <span className="cc-name">{c.name}</span>
              {c.id === acc.crew.id && <span className="cc-now">текущая</span>}
              {locked && <span className="cc-meta">{l.events} {plural(l.events, 'встреча', 'встречи', 'встреч')}</span>}
              <span className="cc-ico">{locked ? Icon.lock : l.linked ? Icon.check : null}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Выбор компаний для нового места — как блок в карточке, по умолчанию отмечена текущая */
export function CrewChecklist({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const acc = useAccount();
  const ui = useUI();
  if (acc.crews.length < 2) return null;
  const toggle = (id: string) => {
    const on = selected.includes(id);
    if (on && selected.length === 1) { ui.fail('Выбери хотя бы одну компанию'); return; }
    onChange(on ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div className="field place-crews-field">
      <span>Компании</span>
      <div className="crew-chips">
        {acc.crews.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button key={c.id} type="button" className={'crew-chip' + (on ? ' on' : '')} onClick={() => toggle(c.id)} aria-pressed={on}>
              <CrewAvatar crew={c} size={30} />
              <span className="cc-name">{c.name}</span>
              {c.id === acc.crew.id && <span className="cc-now">текущая</span>}
              <span className="cc-ico">{on ? Icon.check : null}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
