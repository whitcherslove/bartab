import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { totalBalance } from '../lib/calc';
import { disconnectCrewChat, setCrewAvatar } from '../lib/remote';
import { humanError, supabase } from '../lib/supabase';
import { Icon } from '../components/Icons';
import { Av, CrewAvatar, Pill } from '../components/common';
import { PersonSheet } from '../sheets/PersonSheet';
import { ConnectChatSheet } from '../sheets/ConnectChatSheet';
import { CrewSetup } from './auth/CrewSetup';
import { QrSheet } from '../sheets/QrSheet';

export function CrewScreen() {
  const acc = useAccount();
  const { state } = useStore();
  const ui = useUI();
  const [renaming, setRenaming] = useState(false);
  const [crewName, setCrewName] = useState(acc.crew.name);
  const [avBusy, setAvBusy] = useState(false);

  const changeAvatar = async (file: File | null) => {
    setAvBusy(true);
    try {
      await setCrewAvatar(acc.crew.id, file);
      await acc.reload();
      ui.toast(file ? 'Аватарка компании обновлена' : 'Аватарка убрана');
    } catch (e) {
      ui.toast(humanError(e));
    }
    setAvBusy(false);
  };

  const share = async () => {
    const text = `Залетай в нашу компанию «${acc.crew.name}» в BarTab, там делим счёт за посиделки 🍻`;
    if (navigator.share) {
      try { await navigator.share({ title: 'BarTab', text, url: acc.inviteLink }); } catch { /* отменили */ }
      return;
    }
    copy();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(acc.inviteLink); ui.toast('Ссылка скопирована'); } catch { ui.toast('Выдели ссылку и скопируй вручную'); }
  };

  const rename = async () => {
    const n = crewName.trim();
    if (!n) return;
    const { error } = await supabase.from('crews').update({ name: n }).eq('id', acc.crew.id);
    if (error) return ui.toast(humanError(error));
    await acc.reload();
    setRenaming(false);
    ui.toast('Название обновлено');
  };

  const addCrew = () =>
    ui.open(
      <>
        <h4>Ещё одна компания</h4>
        <CrewSetup embedded myName={acc.profile.name} onDone={async (id) => { acc.setCrewId(id); await acc.reload(); ui.close(); ui.toast('Готово'); }} />
      </>,
    );

  const leave = async () => {
    if (!confirm(`Выйти из компании «${acc.crew.name}»? Посиделки с тобой останутся у друзей, а у тебя пропадут. Вернуться можно по приглашению.`)) return;
    try { await acc.leaveCrew(acc.crew.id); ui.toast('Ты вышел из компании'); } catch (e) { ui.toast(humanError(e)); }
  };

  const removeChat = async () => {
    if (!confirm(`Отключить чат «${acc.crew.tg_chat_name}» от компании? Бот останется в группе, его можно удалить там вручную.`)) return;
    try { await disconnectCrewChat(acc.crew.id); await acc.reload(); ui.toast('Чат отключён'); } catch (e) { ui.toast(humanError(e)); }
  };

  return (
    <>
      <header className="top">
        <h1>Компания</h1>
        <button className="icon-btn" aria-label="Добавить человека" onClick={() => ui.open(<PersonSheet />)}>{Icon.plus}</button>
      </header>

      <div className="crew-head">
        <label className="crew-head-av" aria-label="Сменить аватарку компании">
          <CrewAvatar crew={acc.crew} size={96} />
          <span className="profile-avatar-btn">{Icon.cam}</span>
          <input type="file" accept="image/*" hidden disabled={avBusy} onChange={(e) => e.target.files?.[0] && changeAvatar(e.target.files[0])} />
        </label>
        <div className="crew-head-name">{acc.crew.name}</div>
        <div className="s">{state.people.filter((p) => p.userId && !p.archived).length} в приложении · {state.people.filter((p) => !p.archived).length} всего</div>
        {acc.crew.avatar_url && <button className="link-btn" style={{ margin: '4px 0 0' }} onClick={() => changeAvatar(null)} disabled={avBusy}>Убрать фото</button>}
      </div>

      <h3 style={{ marginTop: 4 }}>Мои компании</h3>
      <div className="list">
        {acc.crews.map((c) => (
          <button key={c.id} className="row" onClick={() => { if (c.id !== acc.crew.id) { acc.setCrewId(c.id); ui.toast(`Компания «${c.name}»`); } }}>
            <CrewAvatar crew={c} size={36} />
            <div className="grow"><div className="t">{c.name}</div></div>
            {c.id === acc.crew.id && <span className="crew-check">{Icon.check}</span>}
          </button>
        ))}
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={addCrew}>{Icon.plus} Создать или вступить</button>

      <h3>«{acc.crew.name}»</h3>
      <div className="list crew-card">
        {renaming ? (
          <div className="row" style={{ gap: 8 }}>
            <input className="inline-input" value={crewName} onChange={(e) => setCrewName(e.target.value)} autoFocus />
            <button className="btn primary sm" onClick={rename}>Ок</button>
          </div>
        ) : (
          <button className="row" onClick={() => { setCrewName(acc.crew.name); setRenaming(true); }}>
            <div className="grow"><div className="s">Название</div><div className="t">{acc.crew.name}</div></div>
            {Icon.edit}
          </button>
        )}
        <div className="row invite">
          <div className="grow"><div className="s">Ссылка-приглашение для друзей</div><div className="invite-link">{acc.inviteLink}</div></div>
        </div>
        <div className="row crew-actions">
          <button className="btn primary sm" onClick={share}>Поделиться</button>
          <button className="btn ghost sm" onClick={() => ui.open(<QrSheet />)}>QR-код</button>
          <button className="btn ghost sm" onClick={copy}>Копировать</button>
        </div>
      </div>

      <h3>Люди <small>баланс по всем посиделкам</small></h3>
      <div className="list">
        {state.people.filter((p) => !p.archived).map((p) => (
          <button key={p.id} className="row" onClick={() => ui.open(<PersonSheet id={p.id} />)}>
            <Av id={p.id} />
            <div className="grow">
              <div className="t">{p.name}{p.id === state.me ? ' (это ты)' : ''}</div>
              <div className="s">{p.tg ? '@' + p.tg : 'нет Telegram'}{p.userId ? '' : ' · без аккаунта'}</div>
            </div>
            <Pill b={totalBalance(state.events, p.id)} />
          </button>
        ))}
      </div>

      <h3>Telegram-чат компании <small>общий для всех</small></h3>
      <div className="list">
        {acc.crew.tg_chat_id ? (
          <div className="row">
            <div className="grow">
              <div className="t">{acc.crew.tg_chat_name}</div>
              <div className="s">{acc.crew.tg_chat_by ? `подключил(а) ${acc.crew.tg_chat_by}` : 'итоги посиделок приходят сюда'}</div>
            </div>
            <button className="btn undo sm" onClick={removeChat}>Отключить</button>
          </div>
        ) : (
          <div className="empty">Подключи групповой чат компании — и любой участник сможет отправлять туда итоги посиделок</div>
        )}
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => ui.open(<ConnectChatSheet />)}>
        {Icon.plus} {acc.crew.tg_chat_id ? 'Подключить другой чат' : 'Подключить чат'}
      </button>

      <div className="foot"><button onClick={leave}>Выйти из компании</button></div>
    </>
  );
}
