import { useState } from 'react';
import { humanError, supabase } from '../../lib/supabase';
import { pendingJoinCode } from '../../lib/account';
import { InstallAction } from '../../components/InstallCard';
import { isIOS, isStandalone } from '../../lib/install';

// Установленное приложение на iPhone живёт отдельно от Safari: ссылка из письма и вход через Google
// открываются в Safari и входят туда, а не в приложение. Поэтому там — только код из письма.
const iosApp = () => isIOS() && isStandalone();
import { Brand } from '../../components/common';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(iosApp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invited = !!pendingJoinCode();
  const [installIntro, setInstallIntro] = useState(() => { try { return !!localStorage.getItem('bartab-install-intro') && !isStandalone(); } catch { return false; } });
  const continueInBrowser = () => {
    try { localStorage.removeItem('bartab-install-intro'); } catch { /* ignore */ }
    setInstallIntro(false);
  };

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

  // ссылка «Позвать в BarTab»: сначала только установка, вход — по ссылке ниже
  if (installIntro) {
    return (
      <main className="auth">
        <Brand />
        <p className="auth-sub">Делим счёт за встречи без калькулятора.</p>
        <div className="auth-card">
          <h4>Поставь BarTab на телефон</h4>
          <InstallAction doneText="Открой BarTab с иконки на экране и войди там." />
        </div>
        <div className="auth-links"><button type="button" onClick={continueInBrowser}>Продолжить в браузере</button></div>
      </main>
    );
  }

  return (
    <main className="auth">
      <Brand />
      <p className="auth-sub">{invited ? 'Тебя позвали в компанию. Войди, чтобы присоединиться.' : 'Делим счёт за встречи без калькулятора.'}</p>

      {!sentTo ? (
        <form className="auth-card" onSubmit={(ev) => { ev.preventDefault(); send(); }}>
          {!iosApp() && (
            <>
              <button type="button" className="btn block google-btn" onClick={google} disabled={busy}>Войти через Google</button>
              <div className="or"><span>или по почте</span></div>
            </>
          )}
          <label className="field">
            <span>Почта</span>
            <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          {error && <p className="auth-err">{error}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Отправляю…' : iosApp() ? 'Прислать код для входа' : 'Прислать ссылку для входа'}</button>
          <p className="hint">{iosApp() ? 'Пароль не нужен: пришлём письмо с кодом — введи его здесь.' : 'Пароль не нужен: пришлём письмо со ссылкой для входа.'}</p>
        </form>
      ) : (
        <form className="auth-card" onSubmit={(ev) => { ev.preventDefault(); verify(); }}>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Проверь почту 📬</p>
          <p style={{ margin: '0 0 14px' }}>Письмо отправлено на <b>{sentTo}</b>. {iosApp() ? 'Скопируй из него код и введи ниже — ссылку не нажимай: она откроется в Safari, а не здесь.' : 'Открой его на этом устройстве и нажми ссылку для входа.'}</p>
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
