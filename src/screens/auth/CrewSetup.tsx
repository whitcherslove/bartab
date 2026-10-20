import { useState } from 'react';
import { humanError, supabase } from '../../lib/supabase';
import { Brand } from '../../components/common';

/** Создать компанию или вступить по коду. Используется при первом входе и из раздела «Компания». */
export function CrewSetup({ myName, error: outerError, onDone, onSignOut, embedded, mode = 'both' }: {
  myName: string;
  error?: string;
  onDone: (crewId: string) => Promise<void> | void;
  onSignOut?: () => void;
  embedded?: boolean;
  mode?: 'both' | 'create' | 'join';
}) {
  const [crewName, setCrewName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(outerError ?? '');

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError('');
    try {
      await onDone(await fn());
    } catch (e) {
      setError(humanError(e));
    }
    setBusy(false);
  };

  const create = () => run(async () => {
    const n = crewName.trim();
    if (!n) throw new Error('Придумай название компании');
    const { data, error: e } = await supabase.rpc('create_crew', { crew_name: n, my_name: myName });
    if (e) throw e;
    return data as string;
  });

  const join = () => run(async () => {
    // принимаем и код, и целую ссылку-приглашение
    const raw = code.trim();
    const c = (raw.match(/join=([\w-]+)/)?.[1] ?? raw).toLowerCase();
    if (!c) throw new Error('Вставь код или ссылку-приглашение');
    const { data, error: e } = await supabase.rpc('join_crew', { code: c });
    if (e) throw e;
    return data as string;
  });

  const body = (
    <>
      {mode !== 'join' && <form className="auth-card" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <h4>Новая компания</h4>
        <label className="field"><span>Название</span><input value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Пятничные" /></label>
        <button className="btn primary block" disabled={busy}>Создать</button>
      </form>}
      {mode !== 'create' && <form className="auth-card" onSubmit={(e) => { e.preventDefault(); join(); }}>
        <h4>Меня позвали</h4>
        <label className="field"><span>Код или ссылка-приглашение</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="a1b2c3d4" autoCapitalize="off" /></label>
        <button className="btn block" disabled={busy}>Вступить</button>
      </form>}
      {error && <p className="auth-err">{error}</p>}
    </>
  );

  if (embedded) return body;

  return (
    <main className="auth">
      <Brand />
      <p className="auth-sub">Компания — это друзья, с которыми вы ходите в бары, кино и магазины. Встречи, места и переводы у неё общие.</p>
      {body}
      {onSignOut && <div className="auth-links"><button type="button" onClick={onSignOut}>Выйти из аккаунта</button></div>}
    </main>
  );
}
