import { useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { fetchInviteCandidates, inviteToCrew, type InviteCandidate } from '../lib/remote';
import { personPlaceholderFor } from '../lib/placeholders';
import { humanError } from '../lib/supabase';
import { Icon } from '../components/Icons';
import { PersonSheet } from './PersonSheet';

/** Добавить человека: новый гость или пригласить из другой своей компании */
export function AddPersonSheet({ onInvited }: { onInvited?: () => void }) {
  const acc = useAccount();
  const { refresh } = useStore();
  const ui = useUI();
  const [data, setData] = useState<{ list: InviteCandidate[]; pending: Set<string> } | null>(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    fetchInviteCandidates(acc.crew.id, acc.crews.map((c) => c.id), acc.session.user.id)
      .then((r) => setData({ list: r.list, pending: new Set(r.pending.map((p) => p.invitee)) }))
      .catch(() => setData({ list: [], pending: new Set() }));
  }, [acc.crew.id, acc.crews, acc.session.user.id]);

  const crewName = (id: string) => acc.crews.find((c) => c.id === id)?.name ?? '';

  const invite = async (c: InviteCandidate) => {
    setBusy(c.userId);
    try {
      await inviteToCrew(acc.crew.id, c.personId, c.userId);
      await refresh();
      onInvited?.();
      ui.close();
      ui.toast(`${c.name}: приглашение отправлено`);
    } catch (e) {
      ui.fail(humanError(e));
      setBusy('');
    }
  };

  return (
    <>
      <h4>Добавить в «{acc.crew.name}»</h4>
      <button className="btn block" onClick={() => ui.open(<PersonSheet />)}>{Icon.plus} Новый гость</button>
      <p className="hint" style={{ margin: '8px 2px 0' }}>Гость — просто имя, без аккаунта. Позже человек сможет привязать себя через приглашение.</p>

      <h3>Из другой компании</h3>
      {!data ? (
        <div className="list"><div className="empty">Загружаю…</div></div>
      ) : data.list.length === 0 ? (
        <div className="list"><div className="empty">Все люди из твоих компаний уже здесь</div></div>
      ) : (
        <div className="list">
          {data.list.map((c) => {
            const pending = data.pending.has(c.userId);
            return (
              <div key={c.userId} className="row">
                <img className="av" src={c.avatar || personPlaceholderFor(c.userId)} alt="" />
                <div className="grow"><div className="t">{c.name}</div><div className="s">из «{crewName(c.crewId)}»</div></div>
                {pending
                  ? <span className="s">приглашение отправлено</span>
                  : <button className="btn primary sm" disabled={!!busy} onClick={() => invite(c)}>{busy === c.userId ? '…' : 'Пригласить'}</button>}
              </div>
            );
          })}
        </div>
      )}
      <p className="hint" style={{ margin: '10px 2px 0' }}>Человек увидит приглашение в приложении и сможет принять или отклонить его. Пока он не ответил, его уже можно добавлять во встречи.</p>
    </>
  );
}
