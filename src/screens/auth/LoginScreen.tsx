import { useState } from 'react';
import { humanError, supabase } from '../../lib/supabase';
import { pendingJoinCode } from '../../lib/account';
import { InstallHelp } from '../../components/InstallCard';
import { isStandalone } from '../../lib/install';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invited = !!pendingJoinCode();
  const installIntro = (() => { try { return !!localStorage.getItem('bartab-install-intro') && !isStandalone(); } catch { return false; } })();

  const send = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setError('Проверь адрес почты');
    setBusy(true);
    setError('');
    const join = pendingJoinCode();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin + '/' + (join ? `?join=${join}` : ''), shouldCreateUser: true },
    });
    setBusy(false);
    if (err) return setError(humanError(err));
    setSentTo(e);
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const join = pendingJoinCode();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' + (join ? `?join=${join}` : '') },
    });
    // при успехе браузер уходит на страницу Google, а потом возвращается уже с входом
    if (err) {
      setBusy(false);
      setError(humanError(err));
    }
  };

  const verify = async () => {
    const token = code.replace(/\s/g, '');
    if (token.length < 6) return setError('Введи код из письма');
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email' });
    setBusy(false);
    if (err) setError(humanError(err));
    // при успехе AccountGate сам переключит экран
  };

  return (
    <main className="auth">
      <div className="brand">🍻 BarTab</div>
      <p className="auth-sub">{invited ? 'Тебя позвали в компанию. Войди, чтобы присоединиться.' : 'Делим счёт в баре без калькулятора.'}</p>
      {installIntro && (
        <div className="auth-card">
          <h4>Сначала поставь приложение</h4>
          <InstallHelp />
          <p className="hint" style={{ textAlign: 'center', margin: '12px 0 0' }}>Потом открой BarTab с экрана телефона и войди там.</p>
        </div>
      )}

      {!sentTo ? (
        <form className="auth-card" onSubmit={(ev) => { ev.preventDefault(); send(); }}>
          <button type="button" className="btn block google-btn" onClick={google} disabled={busy}>Войти через Google</button>
          <div className="or"><span>или по почте</span></div>
          <label className="field">
            <span>Почта</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          {error && <p className="auth-err">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Отправляю…' : 'Прислать ссылку для входа'}</button>
          <p className="hint">Пароль не нужен: пришлём письмо со ссылкой для входа.</p>
        </form>
      ) : (
        <form className="auth-card" onSubmit={(ev) => { ev.preventDefault(); verify(); }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Проверь почту 📬</p>
          <p style={{ margin: '0 0 14px' }}>Письмо отправлено на <b>{sentTo}</b>. Открой его на этом устройстве и нажми ссылку для входа.</p>
          {showCode ? (
            <>
              <label className="field">
                <span>Код из письма</span>
                <input className="code-input num" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={12} />
              </label>
              {error && <p className="auth-err">{error}</p>}
              <button className="btn primary block" disabled={busy}>{busy ? 'Проверяю…' : 'Войти'}</button>
            </>
          ) : (
            error && <p className="auth-err">{error}</p>
          )}
          <div className="auth-links">
            <button type="button" onClick={() => { setSentTo(''); setCode(''); setError(''); setShowCode(false); }}>Другая почта</button>
            <button type="button" onClick={send} disabled={busy}>Отправить ещё раз</button>
            {!showCode && <button type="button" onClick={() => setShowCode(true)}>У меня есть код</button>}
          </div>
          <p className="hint">Письма нет? Проверь «Спам» и «Промоакции».</p>
        </form>
      )}
    </main>
  );
}
