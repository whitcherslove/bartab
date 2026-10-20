import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { uid } from '../lib/format';
import { removePerson } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Av } from '../components/common';

export function PersonSheet({ id }: { id?: string }) {
  const { state, update, refresh } = useStore();
  const ui = useUI();
  const person = id ? state.people.find((p) => p.id === id) : undefined;
  const [name, setName] = useState(person?.name ?? '');
  const [tg, setTg] = useState(person?.tg ?? '');

  const save = () => {
    const n = name.trim();
    if (!n) return ui.toast('Укажи имя');
    const t = tg.trim().replace(/^@/, '');
    update((d) => {
      const p = id ? d.people.find((x) => x.id === id) : undefined;
      if (p) Object.assign(p, { name: n, tg: t });
      else d.people.push({ id: uid(), name: n, tg: t, userId: null, avatar: '' });
    });
    ui.close();
    ui.toast('Сохранено');
  };

  const remove = async () => {
    if (!id || !person) return;
    const used = state.events.filter((e) => e.members.includes(id)).length;
    const account = person.userId ? ' У человека есть аккаунт — доступ к компании закроется.' : '';
    const msg = used
      ? `Удалить ${person.name} из компании? Человек пропадёт из списка людей, но останется в ${used} старых встреч${used === 1 ? 'е' : 'ах'} — суммы в них не пересчитаются.${account}`
      : `Удалить ${person.name} из компании?${account}`;
    if (!confirm(msg)) return;
    try {
      await removePerson(id);
      await refresh();
      ui.close();
      ui.toast(`${person.name}: удаление из компании выполнено`);
    } catch (e) {
      ui.toast(humanError(e));
    }
  };

  // Человек с аккаунтом: данные — из его профиля, менять может только он сам
  if (id && person?.userId) {
    const isMe = id === state.me;
    return (
      <>
        <div className="member-head">
          <Av id={id} lg />
          <div className="grow">
            <h4>{person.name}</h4>
            <div className="s">{person.tg ? '@' + person.tg : 'нет Telegram'}</div>
          </div>
        </div>
        <p className="hint" style={{ margin: '0 0 14px' }}>
          {isMe
            ? 'Это ты. Имя, Telegram и фото меняются в профиле — и сразу обновляются во всех компаниях и встречах.'
            : 'Имя, Telegram и фото берутся из профиля этого человека и обновляются сами.'}
        </p>
        <div className="sheet-btns">
          {isMe
            ? <button className="btn primary" onClick={() => ui.go({ screen: 'profile' })}>Изменить в профиле</button>
            : <button className="btn danger" onClick={remove}>Удалить из компании</button>}
        </div>
      </>
    );
  }

  return (
    <>
      {id && person ? (
        <div className="member-head">
          <Av id={id} lg />
          <div className="grow">
            <h4>{person.name}</h4>
            <div className="s">{person.tg ? '@' + person.tg : 'нет Telegram'} · гость без аккаунта</div>
          </div>
        </div>
      ) : (
        <h4>Новый человек</h4>
      )}
      <label className="field"><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">
        <span>Юзернейм в Telegram, без @</span>
        <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="vasya_pub" autoCapitalize="off" autoCorrect="off" />
      </label>
      <div className="sheet-btns">
        {id && id !== state.me && <button className="btn danger" onClick={remove}>Удалить из компании</button>}
        <button className="btn primary" onClick={save}>Сохранить</button>
      </div>
    </>
  );
}
