import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { totalBalance } from '../lib/calc';
import { Icon } from '../components/Icons';
import { Av, Pill } from '../components/common';
import { PersonSheet } from '../sheets/PersonSheet';
import { CrewCard } from '../components/CrewCard';
import { InstallCard } from '../components/InstallCard';
import { ConnectChatSheet } from '../sheets/ConnectChatSheet';
import { deleteTgChat } from '../lib/remote';
import { humanError } from '../lib/supabase';

export function PeopleScreen() {
  const { state, refresh } = useStore();
  const ui = useUI();

  const removeChat = async (id: string, name: string) => {
    if (!confirm(`Отключить чат «${name}»? Бот останется в группе, его можно удалить там вручную.`)) return;
    try {
      await deleteTgChat(id);
      await refresh();
      ui.toast('Чат отключён');
    } catch (e) {
      ui.toast(humanError(e));
    }
  };

  return (
    <>
      <header className="top">
        <h1>Люди</h1>
        <button className="icon-btn" aria-label="Добавить человека" onClick={() => ui.open(<PersonSheet />)}>{Icon.plus}</button>
      </header>
      <InstallCard />
      <CrewCard />
      <h3>Люди <small>баланс по всем посиделкам</small></h3>
      <div className="list">
        {state.people.map((p) => (
          <button key={p.id} className="row" onClick={() => ui.open(<PersonSheet id={p.id} />)}>
            <Av id={p.id} />
            <div className="grow">
              <div className="t">{p.name}{p.id === state.me ? ' (это ты)' : ''}</div>
              <div className="s">{p.tg ? '@' + p.tg : 'нет Telegram'}</div>
            </div>
            <Pill b={totalBalance(state.events, p.id)} />
          </button>
        ))}
      </div>
      <h3>Мои чаты для итогов <small>видны только тебе</small></h3>
      <div className="list">
        {state.chats.length === 0 && <div className="empty">Подключи групповой чат, и бот будет присылать туда итоги посиделок</div>}
        {state.chats.map((c) => (
          <div key={c.id} className="row">
            <div className="grow"><div className="t">{c.name}</div></div>
            <button className="btn undo sm" onClick={() => removeChat(c.id, c.name)}>Отключить</button>
          </div>
        ))}
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => ui.open(<ConnectChatSheet />)}>{Icon.plus} Подключить чат</button>
    </>
  );
}
