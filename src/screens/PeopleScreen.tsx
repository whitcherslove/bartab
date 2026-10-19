import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { totalBalance } from '../lib/calc';
import { Icon } from '../components/Icons';
import { Av, Pill } from '../components/common';
import { PersonSheet } from '../sheets/PersonSheet';

export function PeopleScreen() {
  const { state, reset } = useStore();
  const ui = useUI();

  const onReset = () => {
    if (!confirm('Вернуть демо-данные? Всё, что ты добавил, удалится.')) return;
    reset();
    ui.toast('Демо-данные восстановлены');
  };

  return (
    <>
      <header className="top">
        <h1>Люди</h1>
        <button className="icon-btn" aria-label="Добавить человека" onClick={() => ui.open(<PersonSheet />)}>{Icon.plus}</button>
      </header>
      <p className="sub">Баланс по всем посиделкам</p>
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
      <h3>Мои чаты для итогов</h3>
      <div className="list">
        {state.chats.map((c) => (
          <div key={c.id} className="row"><div className="grow"><div className="t">{c.name}</div></div></div>
        ))}
      </div>
      <div className="foot"><button onClick={onReset}>Сбросить демо-данные</button></div>
    </>
  );
}
