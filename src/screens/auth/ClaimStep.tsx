import { useState } from 'react';
import type { Person } from '../../lib/types';
import { useAccount } from '../../lib/account';
import { humanError, supabase } from '../../lib/supabase';
import { Brand } from '../../components/common';

/** После вступления в компанию: кто ты в списке людей? */
export function ClaimStep({ people, crewId, onDone }: { people: Person[]; crewId: string; onDone: () => Promise<void> }) {
  const { profile, crew, session } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const free = people.filter((p) => !p.userId && !p.archived);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onDone();
    } catch (e) {
      setError(humanError(e));
      setBusy(false);
    }
  };

  const claim = (p: Person) => run(async () => {
    const { error: e } = await supabase.rpc('claim_person', { p: p.id });
    if (e) throw e;
  });

  const addMe = () => run(async () => {
    const { error: e } = await supabase.from('people').insert({ crew_id: crewId, name: profile.name, tg: profile.tg, user_id: session.user.id });
    if (e) throw e;
  });

  return (
    <main className="auth">
      <Brand />
      <p className="auth-sub">Ты в компании «{crew.name}». Кто ты в списке? Если тебя уже добавляли во встречи, выбери себя — вся история сохранится.</p>
      {free.length > 0 && (
        <div className="list">
          {free.map((p) => (
            <button key={p.id} className="row" onClick={() => claim(p)} disabled={busy}>
              <div className="grow"><div className="t">{p.name}</div>{p.tg && <div className="s">@{p.tg}</div>}</div>
              <span className="btn ghost sm">Это я</span>
            </button>
          ))}
        </div>
      )}
      <button className="btn primary block" onClick={addMe} disabled={busy}>
        {free.length ? `Меня нет в списке, добавить «${profile.name}»` : `Добавить меня как «${profile.name}»`}
      </button>
      {error && <p className="auth-err">{error}</p>}
    </main>
  );
}
