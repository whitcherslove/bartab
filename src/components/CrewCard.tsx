import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { CrewSetup } from '../screens/auth/CrewSetup';

/** Компания: приглашение друзей, переключение, выход */
export function CrewCard() {
  const acc = useAccount();
  const ui = useUI();

  const share = async () => {
    const text = `Залетай в нашу компанию «${acc.crew.name}» в BarTab, там делим счёт за посиделки 🍻`;
    if (navigator.share) {
      try { await navigator.share({ title: 'BarTab', text, url: acc.inviteLink }); return; } catch { /* отменили — ничего */ return; }
    }
    copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(acc.inviteLink);
      ui.toast('Ссылка скопирована');
    } catch {
      ui.toast('Не удалось скопировать, выдели ссылку вручную');
    }
  };

  const addCrew = () =>
    ui.open(
      <>
        <h4>Ещё одна компания</h4>
        <CrewSetup
          embedded
          myName={acc.profile.name}
          onDone={async (id) => {
            acc.setCrewId(id);
            await acc.reload();
            ui.close();
            ui.toast('Готово');
          }}
        />
      </>,
    );

  const signOut = async () => {
    if (!confirm('Выйти из аккаунта?')) return;
    await acc.signOut();
  };

  return (
    <>
      <h3>Компания</h3>
      <div className="list crew-card">
        <div className="row">
          <div className="grow">
            <div className="t">{acc.crew.name}</div>
            <div className="s">Ты вошёл как {acc.profile.name}{acc.session.user.email ? `, ${acc.session.user.email}` : ''}</div>
          </div>
        </div>
        {acc.crews.length > 1 && (
          <div className="row">
            <label className="field" style={{ margin: 0, width: '100%' }}>
              <span>Переключить компанию</span>
              <select value={acc.crew.id} onChange={(e) => { acc.setCrewId(e.target.value); ui.toast('Компания переключена'); }}>
                {acc.crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="row invite">
          <div className="grow">
            <div className="s">Ссылка-приглашение для друзей</div>
            <div className="invite-link">{acc.inviteLink}</div>
          </div>
        </div>
        <div className="row crew-actions">
          <button className="btn primary sm" onClick={share}>Поделиться</button>
          <button className="btn ghost sm" onClick={copy}>Копировать</button>
        </div>
      </div>
      <div className="foot" style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
        <button onClick={addCrew}>Другая компания</button>
        <button onClick={signOut}>Выйти из аккаунта</button>
      </div>
    </>
  );
}
