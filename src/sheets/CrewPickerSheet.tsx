import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { Icon } from '../components/Icons';
import { CrewAvatar } from '../components/common';
import { CrewSetup } from '../screens/auth/CrewSetup';

/** Переключение компаний + явные кнопки «Создать» и «Вступить» */
export function CrewPickerSheet() {
  const acc = useAccount();
  const ui = useUI();

  const pick = (id: string, name: string) => {
    ui.close();
    if (id !== acc.crew.id) { acc.setCrewId(id); ui.toast(`Компания «${name}»`); }
  };

  const openForm = (mode: 'create' | 'join') =>
    ui.open(
      <>
        <h4>{mode === 'create' ? 'Новая компания' : 'Вступить по приглашению'}</h4>
        <CrewSetup
          embedded
          mode={mode}
          myName={acc.profile.name}
          onDone={async (id) => { acc.setCrewId(id); await acc.reload(); ui.close(); ui.toast('Готово'); }}
        />
      </>,
    );

  return (
    <>
      <h4>Мои компании</h4>
      <div className="list">
        {acc.crews.map((c) => (
          <button key={c.id} className="row" onClick={() => pick(c.id, c.name)}>
            <CrewAvatar crew={c} size={40} />
            <div className="grow"><div className="t">{c.name}</div></div>
            {c.id === acc.crew.id && <span className="crew-check">{Icon.check}</span>}
          </button>
        ))}
      </div>
      <div className="picker-new">
        <button className="btn primary block" onClick={() => openForm('create')}>{Icon.plus} Создать компанию</button>
        <button className="btn block" onClick={() => openForm('join')}>Вступить по приглашению</button>
      </div>
    </>
  );
}
