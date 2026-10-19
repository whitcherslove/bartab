import { useState } from 'react';
import type { Profile } from '../../lib/account';
import { humanError } from '../../lib/supabase';

export function ProfileStep({ profile, email, onSave }: { profile: Profile; email: string; onSave: (p: { name: string; tg: string }) => Promise<void> }) {
  const [name, setName] = useState(profile.name || email.split('@')[0]);
  const [tg, setTg] = useState(profile.tg);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Как тебя называть?');
    setBusy(true);
    try {
      await onSave({ name: n, tg: tg.trim().replace(/^@/, '') });
    } catch (e) {
      setError(humanError(e));
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="brand">🍻 BarTab</div>
      <p className="auth-sub">Познакомимся. Так тебя увидят друзья в посиделках.</p>
      <form className="auth-card" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="field"><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label className="field">
          <span>Юзернейм в Telegram, без @ (необязательно)</span>
          <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="vasya_pub" autoCapitalize="off" autoCorrect="off" />
        </label>
        {error && <p className="auth-err">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Сохраняю…' : 'Дальше'}</button>
      </form>
    </main>
  );
}
