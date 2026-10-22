import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { humanError } from '../lib/supabase';
import { CrewAvatar } from './common';

/** «Тебя позвали в компанию» — принять или отклонить */
export function InviteCards() {
  const acc = useAccount();
  const ui = useUI();
  const [busy, setBusy] = useState('');
  if (!acc.invites.length) return null;

  const answer = async (id: string, name: string, accept: boolean) => {
    setBusy(id);
    try {
      await acc.respondInvite(id, accept);
      ui.toast(accept ? `Ты в компании «${name}» 🎉` : 'Приглашение отклонено');
    } catch (e) {
      ui.toast(humanError(e));
    }
    setBusy('');
  };

  return (
    <div className="invite-cards">
      {acc.invites.map((i) => (
        <div key={i.id} className="invite-card">
          <CrewAvatar crew={{ id: i.crew_id, name: i.crew_name, avatar_url: i.crew_avatar }} size={44} />
          <div className="grow">
            <div className="t">Тебя позвали в «{i.crew_name}»</div>
            {i.inviter_name && <div className="s">приглашение от: {i.inviter_name}</div>}
          </div>
          <div className="invite-actions">
            <button className="btn primary sm" disabled={busy === i.id} onClick={() => answer(i.id, i.crew_name, true)}>Принять</button>
            <button className="btn undo sm" disabled={busy === i.id} onClick={() => answer(i.id, i.crew_name, false)}>Отклонить</button>
          </div>
        </div>
      ))}
    </div>
  );
}
