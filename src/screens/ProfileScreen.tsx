import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { stats } from '../lib/calc';
import { CURRENCIES, fdate, money } from '../lib/format';
import { personPlaceholderFor } from '../lib/placeholders';
import { uploadAvatar } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { ACCENTS, getAccent, getTheme, setAccent, setTheme, type Accent, type Theme } from '../lib/theme';
import { Icon } from '../components/Icons';
import { InstallCard } from '../components/InstallCard';
import { PhotoChoiceSheet } from '../components/PhotoPick';
import { getHome, getTabOrder, setHome, setTabOrder, TAB_ICONS, TAB_LABELS, type TabId } from '../lib/tabs';
import { PlacePhoto } from '../components/common';

export function ProfileScreen() {
  const acc = useAccount();
  const { state, refresh } = useStore();
  const ui = useUI();
  const [name, setName] = useState(acc.profile.name);
  const [tg, setTg] = useState(acc.profile.tg);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [accent, setAccentState] = useState<Accent>(getAccent);
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
    ui.toast(`Главный экран — «${TAB_LABELS[t]}»`);
  };
  const dirty = name.trim() !== acc.profile.name || tg.trim().replace(/^@/, '') !== acc.profile.tg;

  const save = async () => {
    if (!name.trim()) return ui.toast('Как тебя называть?');
    setBusy(true);
    try {
      await acc.saveProfile({ name: name.trim(), tg: tg.trim().replace(/^@/, '') });
      await refresh();
      ui.toast('Профиль сохранён');
    } catch (e) {
      ui.toast(humanError(e));
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
      ui.toast('Аватарка обновлена');
    } catch (e) {
      ui.toast(humanError(e));
    }
    setBusy(false);
  };

  const removeAvatar = async () => {
    setBusy(true);
    try {
      await acc.saveProfile({ name: acc.profile.name, tg: acc.profile.tg, avatar_url: '' });
      await refresh();
    } catch (e) {
      ui.toast(humanError(e));
    }
    setBusy(false);
  };

  const pickTheme = (t: Theme) => { setTheme(t); setThemeState(t); };

  const signOut = async () => {
    if (!confirm('Выйти из аккаунта?')) return;
    await acc.signOut();
  };

  // ----- Мои посиделки (в текущей компании) -----
  const mine = state.events.filter((e) => e.members.includes(state.me)).sort((a, b) => b.date.localeCompare(a.date));
  const spent = mine.reduce((s, e) => s + stats(e, state.me).owed, 0);
  const visits = new Map<string, number>();
  mine.forEach((e) => e.placeId && visits.set(e.placeId, (visits.get(e.placeId) ?? 0) + 1));
  const topPlaces = [...visits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, n]) => ({ place: state.places.find((p) => p.id === id), n })).filter((x) => x.place);


  return (
    <>
      <header className="top"><h1>Профиль</h1></header>

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

      <h3>Мои посиделки <small>в компании «{acc.crew.name}»</small></h3>
      {mine.length === 0 ? (
        <div className="list"><div className="empty">Пока ни одной. Самое время позвать друзей 🍻</div></div>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat"><b className="num">{mine.length}</b><span>{mine.length % 10 === 1 && mine.length % 100 !== 11 ? 'посиделка' : 'посиделок'}</span></div>
            <div className="stat"><b className="num">{money(spent)}</b><span>потрачено</span></div>
            <div className="stat"><b className="num">{money(spent / mine.length)}</b><span>за вечер</span></div>
          </div>
          {topPlaces.length > 0 && (
            <>
              <h3>Любимые бары</h3>
              <div className="list">
                {topPlaces.map(({ place, n }) => (
                  <div key={place!.id} className="row">
                    <PlacePhoto place={place} className="place-thumb" />
                    <div className="grow"><div className="t">{place!.name}</div><div className="s">{place!.address}</div></div>
                    <span className="s">{n} раз</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <h3>Последние</h3>
          <div className="list">
            {mine.slice(0, 5).map((e) => {
              const place = state.places.find((p) => p.id === e.placeId);
              return (
                <button key={e.id} className="row" onClick={() => ui.go({ screen: 'event', id: e.id })}>
                  <div className="grow"><div className="t">{place?.name ?? 'Без места'}</div><div className="s">{fdate(e.date)}</div></div>
                  <span className="amt num">{money(stats(e, state.me).owed)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <h3>Валюта</h3>
      <label className="field" style={{ marginBottom: 0 }}>
        <select
          value={acc.profile.currency || 'RUB'}
          onChange={async (e) => { try { await acc.saveCurrency(e.target.value); ui.toast('Валюта сохранена'); } catch (err) { ui.toast(humanError(err)); } }}
        >
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.code})</option>)}
        </select>
      </label>
      <p className="hint">Это подпись к суммам, курсы не пересчитываются. Выбирай ту, в которой платили.</p>

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
            <button key={a.id} type="button" className="swatch" aria-pressed={accent === a.id} onClick={() => { setAccent(a.id); setAccentState(a.id); }}>
              <i style={{ background: dark ? a.dark : a.light }} />
              {a.name}
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

      <InstallCard />

      <div className="foot"><button onClick={signOut}>Выйти из аккаунта</button></div>
    </>
  );
}
