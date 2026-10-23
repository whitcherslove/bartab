import { useEffect, useState } from 'react';
import { isAdmin } from '../lib/admin';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { personPlaceholderFor } from '../lib/placeholders';
import { uploadAvatar } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { ACCENTS, getAccent, getTheme, setAccent, setTheme, type Accent, type Theme } from '../lib/theme';
import { Icon } from '../components/Icons';
import { InstallCard } from '../components/InstallCard';
import { MyVisits } from '../components/MyVisits';
import { MyDebts } from '../components/MyDebts';
import { PushCard } from '../components/PushCard';
import { useSwipeTabs } from '../lib/swipe';
import { QrSheet } from '../sheets/QrSheet';
import { PhotoChoiceSheet } from '../components/PhotoPick';
import { getHome, getTabOrder, setHome, setTabOrder, TAB_ICONS, TAB_LABELS, type TabId } from '../lib/tabs';
import { done } from '../lib/motion';
import { CurrencyPicker, currencyLabel } from '../components/Pickers';

const SECTION_KEY = 'bartab-profile-section';

export function ProfileScreen() {
  const acc = useAccount();
  const { refresh } = useStore();
  const ui = useUI();
  const [name, setName] = useState(acc.profile.name);
  const [tg, setTg] = useState(acc.profile.tg);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [accent, setAccentState] = useState<Accent>(getAccent);
  const [admin, setAdmin] = useState(false);
  // открытая вкладка (Профиль / Настройки) переживает перерисовку экрана —
  // например, смена валюты пересоздаёт экраны, и раньше выкидывало в «Профиль»
  const [section, setSectionState] = useState<'me' | 'settings'>(() => {
    try { return sessionStorage.getItem(SECTION_KEY) === 'settings' ? 'settings' : 'me'; } catch { return 'me'; }
  });
  const setSection = (v: 'me' | 'settings') => {
    setSectionState(v);
    try { sessionStorage.setItem(SECTION_KEY, v); } catch { /* ignore */ }
  };
  const swipe = useSwipeTabs(['me', 'settings'] as const, section, setSection);
  useEffect(() => { isAdmin().then(setAdmin); }, []);
  const [order, setOrderState] = useState<TabId[]>(getTabOrder);
  const [home, setHomeState] = useState<TabId>(getHome);

  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setOrderState(next);
    setTabOrder(next);
  };
  const pickHome = (t: TabId) => {
    setHomeState(t);
    setHome(t);
    done();
  };
  const dirty = name.trim() !== acc.profile.name || tg.trim().replace(/^@/, '') !== acc.profile.tg;

  const save = async () => {
    if (!name.trim()) return ui.fail('Как тебя называть?');
    setBusy(true);
    try {
      await acc.saveProfile({ name: name.trim(), tg: tg.trim().replace(/^@/, '') });
      await refresh();
      done();
    } catch (e) {
      ui.fail(humanError(e));
    }
    setBusy(false);
  };

  const onAvatar = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAvatar(acc.session.user.id, file);
      await acc.saveProfile({ name: acc.profile.name, tg: acc.profile.tg, avatar_url: url });
      await refresh();
      done();
    } catch (e) {
      ui.fail(humanError(e));
    }
    setBusy(false);
  };

  const removeAvatar = async () => {
    setBusy(true);
    try {
      await acc.saveProfile({ name: acc.profile.name, tg: acc.profile.tg, avatar_url: '' });
      await refresh();
    } catch (e) {
      ui.fail(humanError(e));
    }
    setBusy(false);
  };

  const pickTheme = (t: Theme) => { setTheme(t); setThemeState(t); };

  const appLink = `${window.location.origin}/?install=1`;
  const shareApp = async () => {
    const text = 'BarTab — делим счёт за встречи без калькулятора 🍻 Поставь приложение:';
    if (navigator.share) { try { await navigator.share({ title: 'BarTab', text, url: appLink }); } catch { /* отменили */ } return; }
    copyApp();
  };
  const copyApp = async () => {
    try { await navigator.clipboard.writeText(appLink); ui.toast('Ссылка скопирована'); } catch { ui.fail('Выдели ссылку и скопируй вручную'); }
  };

  const signOut = async () => {
    if (!confirm('Выйти из аккаунта?')) return;
    await acc.signOut();
  };


  return (
    <>
      <header className="top"><h1>Профиль</h1></header>

      <div className="seg profile-seg">
        <button type="button" aria-pressed={section === 'me'} onClick={() => swipe.go('me')}>Профиль</button>
        <button type="button" aria-pressed={section === 'settings'} onClick={() => swipe.go('settings')}>Настройки</button>
      </div>

      <div className={'swipe-area ' + swipe.enterClass} key={section} {...swipe.bind}>
      {section === 'me' ? (
        <>
      <div className="profile-head">
        <button
          type="button"
          className="profile-avatar"
          aria-label="Сменить фото"
          disabled={busy}
          onClick={() => ui.open(<PhotoChoiceSheet title="Фото профиля" facing="user" onFile={onAvatar} onRemove={acc.profile.avatar_url ? removeAvatar : undefined} />)}
        >
          <img src={acc.profile.avatar_url || personPlaceholderFor(acc.profile.id)} alt="" />
          <span className="profile-avatar-btn">{Icon.cam}</span>
        </button>
        <div className="grow">
          <div className="profile-name">{acc.profile.name}</div>
          <div className="s">{acc.session.user.email}</div>
        </div>
      </div>

      <div className="list form-card">
        <label className="field"><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field">
          <span>Юзернейм в Telegram, без @</span>
          <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="vasya_pub" autoCapitalize="off" autoCorrect="off" />
        </label>
        {dirty && <button className="btn primary block" onClick={save} disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>}
        <p className="hint" style={{ margin: dirty ? '10px 2px 0' : 0 }}>Telegram и фото увидят друзья во всех твоих компаниях.</p>
      </div>

      <MyDebts />

      <h3>Мои встречи <small>во всех компаниях</small></h3>
      <MyVisits />

      <InstallCard />

      <h3>Позвать в BarTab <small>без привязки к компании</small></h3>
      <div className="list crew-card">
        <div className="row invite">
          <div className="grow"><div className="s">Ссылка сразу предлагает установить приложение</div><div className="invite-link">{appLink}</div></div>
        </div>
        <div className="row crew-actions">
          <button className="btn primary sm" onClick={shareApp}>Поделиться</button>
          <button className="btn ghost sm" onClick={() => ui.open(<QrSheet link={appLink} title="BarTab" top={<img src="/icon-192.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />} hint="Наведи камеру телефона на код — откроется установка BarTab." />)}>QR-код</button>
          <button className="btn ghost sm" onClick={copyApp}>Копировать</button>
        </div>
      </div>

        </>
      ) : (
        <>
      <h3>Валюта по умолчанию</h3>
      <button
        type="button"
        className="pick-field"
        onClick={() => ui.open(
          <CurrencyPicker
            title="Валюта по умолчанию"
            value={acc.profile.currency || 'RUB'}
            onPick={async (code) => { ui.close(); try { await acc.saveCurrency(code); done(); } catch (err) { ui.fail(humanError(err)); } }}
          />,
        )}
      >
        <span className="grow pick-val">{currencyLabel(acc.profile.currency || 'RUB')}</span>
        <span className="pick-chev">{Icon.chev}</span>
      </button>
      <p className="hint">Подставляется в новые встречи. У каждой встречи валюту можно поменять в «Изменить». Курсы не пересчитываются.</p>

      <h3>Тема</h3>
      <div className="seg">
        <button type="button" aria-pressed={theme === 'system'} onClick={() => pickTheme('system')}>Как в системе</button>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => pickTheme('light')}>Светлая</button>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => pickTheme('dark')}>Тёмная</button>
      </div>

      <h3>Цвет приложения</h3>
      <div className="swatches">
        {ACCENTS.map((a) => {
          const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          return (
            <button key={a.id} type="button" className="swatch" aria-pressed={accent === a.id} aria-label={a.name} title={a.name} onClick={() => { setAccent(a.id); setAccentState(a.id); }}>
              <i style={{ background: dark ? a.dark : a.light }} />
            </button>
          );
        })}
      </div>

      <h3>Вкладки <small>порядок и главный экран</small></h3>
      <div className="list">
        {order.map((t, i) => (
          <div key={t} className="row tab-row">
            <span className="tab-ico">{Icon[TAB_ICONS[t]]}</span>
            <div className="grow"><div className="t">{TAB_LABELS[t]}</div>{home === t && <div className="s">открывается при запуске</div>}</div>
            <button className={'icon-btn sm' + (home === t ? ' on' : '')} aria-label={`Сделать «${TAB_LABELS[t]}» главным экраном`} aria-pressed={home === t} onClick={() => pickHome(t)}>{Icon.star}</button>
            <button className="icon-btn sm" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>{Icon.up}</button>
            <button className="icon-btn sm" aria-label="Ниже" disabled={i === order.length - 1} onClick={() => move(i, 1)}>{Icon.down}</button>
          </div>
        ))}
      </div>

      <PushCard />

      {admin && (
        <div className="list" style={{ marginTop: 24 }}>
          <button className="row" onClick={() => ui.go({ screen: 'admin' })}>
            <div className="grow"><div className="t">Админка</div><div className="s">пользователи, компании, статистика</div></div>
            <span className="history-more" aria-hidden="true">›</span>
          </button>
        </div>
      )}

      <h3>Аккаунт</h3>
      <div className="list">
        <div className="row"><div className="grow"><div className="t">{acc.session.user.email}</div><div className="s">вход через {acc.session.user.app_metadata?.provider === 'google' ? 'Google' : 'почту'}</div></div></div>
      </div>
      <div className="foot"><button onClick={signOut}>Выйти из аккаунта</button></div>
        </>
      )}
      </div>
    </>
  );
}
