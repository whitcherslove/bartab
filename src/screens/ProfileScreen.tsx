import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { stats } from '../lib/calc';
import { fdate, hueOf, money } from '../lib/format';
import { uploadAvatar } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { Icon } from '../components/Icons';
import { InstallCard } from '../components/InstallCard';
import { PlacePhoto } from '../components/common';

export function ProfileScreen() {
  const acc = useAccount();
  const { state, refresh } = useStore();
  const ui = useUI();
  const [name, setName] = useState(acc.profile.name);
  const [tg, setTg] = useState(acc.profile.tg);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState<Theme>(getTheme);
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

  const initial = (acc.profile.name || '?').slice(0, 1).toUpperCase();

  return (
    <>
      <header className="top"><h1>Профиль</h1></header>

      <div className="profile-head">
        <label className="profile-avatar" aria-label="Сменить фото">
          {acc.profile.avatar_url
            ? <img src={acc.profile.avatar_url} alt="" />
            : <span style={{ background: `hsl(${hueOf(acc.profile.name + acc.profile.id)} 45% 42%)` }}>{initial}</span>}
          <span className="profile-avatar-btn">{Icon.cam}</span>
          <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => onAvatar(e.target.files?.[0])} />
        </label>
        <div className="grow">
          <div className="profile-name">{acc.profile.name}</div>
          <div className="s">{acc.session.user.email}</div>
          {acc.profile.avatar_url && <button className="link-btn" style={{ margin: '6px 0 0' }} onClick={removeAvatar} disabled={busy}>Убрать фото</button>}
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

      <h3>Тема</h3>
      <div className="seg">
        <button type="button" aria-pressed={theme === 'system'} onClick={() => pickTheme('system')}>Как в системе</button>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => pickTheme('light')}>Светлая</button>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => pickTheme('dark')}>Тёмная</button>
      </div>

      <InstallCard />

      <div className="foot"><button onClick={signOut}>Выйти из аккаунта</button></div>
    </>
  );
}
