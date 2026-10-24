import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { balancesByCurrency } from '../lib/calc';
import { disconnectCrewChat, setCrewAvatar } from '../lib/remote';
import { humanError, supabase } from '../lib/supabase';
import { Icon } from '../components/Icons';
import { Av, CrewAvatar, MultiPill } from '../components/common';
import { PersonSheet } from '../sheets/PersonSheet';
import { ConnectChatSheet } from '../sheets/ConnectChatSheet';
import { QrSheet } from '../sheets/QrSheet';
import { PhotoChoiceSheet } from '../components/PhotoPick';
import { CrewPickerSheet } from '../sheets/CrewPickerSheet';
import { AddPersonSheet } from '../sheets/AddPersonSheet';
import { InviteCards } from '../components/InviteCards';
import { done } from '../lib/motion';
import { peek, put } from '../lib/cached';

export function CrewScreen() {
  const acc = useAccount();
  const { state } = useStore();
  const ui = useUI();
  const [renaming, setRenaming] = useState(false);
  const [crewName, setCrewName] = useState(acc.crew.name);
  const [avBusy, setAvBusy] = useState(false);
  // гости, которых пригласили и ждём ответа
  // запоминаем, чтобы пометки «ждём ответа» не появлялись с задержкой
  const pendingKey = `pending:${acc.crew.id}`;
  const [pendingList, setPendingList] = useState<{ key: string; ids: string[] }>(() => ({ key: pendingKey, ids: peek<string[]>(pendingKey) ?? [] }));
  const pendingPeople = new Set(pendingList.key === pendingKey ? pendingList.ids : peek<string[]>(pendingKey) ?? []);
  const loadPending = useCallback(() => {
    supabase.rpc('crew_pending_invites', { c: acc.crew.id }).then(({ data, error }) => {
      if (error) return;
      const ids = ((data ?? []) as { person_id: string | null }[]).map((r) => r.person_id ?? '').filter(Boolean);
      put(pendingKey, ids);
      setPendingList({ key: pendingKey, ids });
    });
  }, [acc.crew.id, pendingKey]);
  useEffect(() => { loadPending(); }, [loadPending]);

  const changeAvatar = async (file: File | null) => {
    setAvBusy(true);
    try {
      await setCrewAvatar(acc.crew.id, file);
      await acc.reload();
      done();
    } catch (e) {
      ui.fail(humanError(e));
    }
    setAvBusy(false);
  };

  const share = async () => {
    const text = `Залетай в нашу компанию «${acc.crew.name}» в BarTab, там делим счёт за встречи 🍻`;
    if (navigator.share) {
      try { await navigator.share({ title: 'BarTab', text, url: acc.inviteLink }); } catch { /* отменили */ }
      return;
    }
    copy();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(acc.inviteLink); ui.toast('Ссылка скопирована'); } catch { ui.fail('Выдели ссылку и скопируй вручную'); }
  };

  const rename = async () => {
    const n = crewName.trim();
    if (!n) return;
    const { error } = await supabase.from('crews').update({ name: n }).eq('id', acc.crew.id);
    if (error) return ui.fail(humanError(error));
    await acc.reload();
    setRenaming(false);
    done();
  };


  const leave = async () => {
    if (!(await ui.ask({ title: `Выйти из компании «${acc.crew.name}»?`, text: 'Встречи с тобой останутся у друзей, а у тебя пропадут. Вернуться можно по приглашению.', ok: 'Выйти', danger: true }))) return;
    try { await acc.leaveCrew(acc.crew.id); ui.toast('Выход из компании выполнен'); } catch (e) { ui.fail(humanError(e)); }
  };

  const removeChat = async () => {
    if (!(await ui.ask({ title: `Отключить чат «${acc.crew.tg_chat_name}»?`, text: 'Бот останется в группе, его можно удалить там вручную.', ok: 'Отключить', danger: true }))) return;
    try { await disconnectCrewChat(acc.crew.id); await acc.reload(); done(); } catch (e) { ui.fail(humanError(e)); }
  };

  return (
    <>
      <header className="top"><h1>Компания</h1></header>
      <InviteCards />


      <div className="crew-head">
        <button
          type="button"
          className="crew-head-av"
          aria-label="Сменить аватарку компании"
          disabled={avBusy}
          onClick={() => ui.open(<PhotoChoiceSheet title="Аватарка компании" facing="environment" onFile={(f) => changeAvatar(f)} onRemove={acc.crew.avatar_url ? () => changeAvatar(null) : undefined} />)}
        >
          <CrewAvatar crew={acc.crew} size={96} />
          <span className="profile-avatar-btn">{Icon.cam}</span>
        </button>
        {renaming ? (
          <div className="crew-rename">
            <input className="inline-input" value={crewName} onChange={(e) => setCrewName(e.target.value)} autoFocus onKeyDown={(e) => e.key === 'Enter' && rename()} />
            <button className="btn primary sm" onClick={rename}>Ок</button>
          </div>
        ) : (
          <div className="crew-head-row">
            <button className="crew-head-name" onClick={() => ui.open(<CrewPickerSheet />)} aria-label="Сменить компанию">
              {acc.crew.name} <span className="crew-caret">{Icon.down}</span>
            </button>
            <button className="icon-btn sm" onClick={() => { setCrewName(acc.crew.name); setRenaming(true); }} aria-label="Переименовать компанию">{Icon.edit}</button>
          </div>
        )}
        <div className="s">{(() => { const n = state.people.filter((p) => !p.archived).length; const m10 = n % 10, m100 = n % 100; return `${n} ${m10 === 1 && m100 !== 11 ? 'участник' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'участника' : 'участников'}`; })()}</div>
      </div>

      <h3>
        <span>Люди <small>баланс по всем встречам</small></span>
        <button className="link-btn add-link" onClick={() => ui.open(<AddPersonSheet onInvited={loadPending} />)}>{Icon.plus} Добавить</button>
      </h3>
      <div className="list">
        {state.people.filter((p) => !p.archived).map((p) => (
          <button key={p.id} data-flash={p.id} className="row" onClick={() => ui.open(<PersonSheet id={p.id} />)}>
            <Av id={p.id} />
            <div className="grow">
              <div className="t">{p.name}{p.id === state.me ? ' (это ты)' : ''}</div>
              <div className="s">{pendingPeople.has(p.id) ? 'ждёт ответа на приглашение' : `${p.tg ? '@' + p.tg : 'нет Telegram'}${p.userId ? '' : ' · без аккаунта'}`}</div>
            </div>
            <MultiPill balances={balancesByCurrency(state.events, p.id)} me={p.id === state.me} />
          </button>
        ))}
      </div>

      <h3>Пригласить друзей</h3>
      <div className="list crew-card">
        <div className="row invite">
          <div className="grow"><div className="s">Ссылка-приглашение в «{acc.crew.name}»</div><div className="invite-link">{acc.inviteLink}</div></div>
        </div>
        <div className="row crew-actions">
          <button className="btn primary sm" onClick={share}>Поделиться</button>
          <button className="btn ghost sm" onClick={() => ui.open(<QrSheet />)}>QR-код</button>
          <button className="btn ghost sm" onClick={copy}>Копировать</button>
        </div>
      </div>

      <h3>Telegram-чат компании <small>общий для всех</small></h3>
      <div className="list">
        {acc.crew.tg_chat_id ? (
          <div className="row">
            <div className="grow">
              <div className="t">{acc.crew.tg_chat_name}</div>
              <div className="s">{acc.crew.tg_chat_by ? `подключение: ${acc.crew.tg_chat_by}` : 'итоги встреч приходят сюда'}</div>
            </div>
            <button className="btn ghost sm" onClick={() => ui.open(<ConnectChatSheet />)}>Сменить</button>
            <button className="btn undo sm" onClick={removeChat}>Отключить</button>
          </div>
        ) : (
          <div className="empty">Подключи групповой чат компании — и любой участник сможет отправлять туда итоги встреч</div>
        )}
      </div>
      {!acc.crew.tg_chat_id && (
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => ui.open(<ConnectChatSheet />)}>{Icon.plus} Подключить чат</button>
      )}

      <div className="foot"><button onClick={leave}>Выйти из компании</button></div>
    </>
  );
}
