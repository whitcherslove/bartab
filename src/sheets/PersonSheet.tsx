import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { uid } from '../lib/format';

export function PersonSheet({ id }: { id?: string }) {
  const { state, update } = useStore();
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
      else d.people.push({ id: uid(), name: n, tg: t });
    });
    ui.close();
    ui.toast('Сохранено');
  };

  return (
    <>
      <h4>{id ? 'Человек' : 'Новый человек'}</h4>
      <label className="field"><span>Имя</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">
        <span>Юзернейм в Telegram, без @</span>
        <input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="vasya_pub" autoCapitalize="off" autoCorrect="off" />
      </label>
      <div className="sheet-btns"><button className="btn primary" onClick={save}>Сохранить</button></div>
    </>
  );
}
