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
export function PlaceCrews({ placeId }: { placeId: string }) {
  const acc = useAccount();
  const ui = useUI();
  const { refresh } = useStore();
  const [links, setLinks] = useState<PlaceLink[] | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    let alive = true;
    placeLinks(placeId).then((l) => alive && setLinks(l)).catch(() => alive && setLinks([]));
    return () => { alive = false; };
  }, [placeId]);

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
              <CrewAvatar crew={c} size={24} />
              <span className="cc-name">{c.name}</span>
              {locked ? <span className="cc-ico">{Icon.lock}</span> : l.linked && <span className="cc-ico">{Icon.check}</span>}
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
              <CrewAvatar crew={c} size={24} />
              <span className="cc-name">{c.name}</span>
              {on && <span className="cc-ico">{Icon.check}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
