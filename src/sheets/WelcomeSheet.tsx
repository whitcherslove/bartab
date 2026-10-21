import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { isStandalone } from '../lib/install';
import { CrewAvatar } from '../components/common';
import { InstallAction } from '../components/InstallCard';

/** Приветствие после вступления по приглашению; в браузере — одно действие установки */
export function WelcomeSheet() {
  const acc = useAccount();
  const ui = useUI();
  const inApp = isStandalone();
  return (
    <div className="qr-sheet">
      <CrewAvatar crew={acc.crew} size={72} />
      <h4>Ты в компании «{acc.crew.name}» 🎉</h4>
      {inApp ? (
        <>
          <p className="hint welcome-text">Здесь общие встречи, места и переводы компании.</p>
          <button className="btn primary block" onClick={() => ui.close()}>Отлично</button>
        </>
      ) : (
        <>
          <p className="hint welcome-text">Поставь BarTab на экран телефона — так быстрее открывать встречи и делить счёт.</p>
          <InstallAction onDone={() => ui.close()} doneText="Открой BarTab с иконки — вход сохранится." />
        </>
      )}
    </div>
  );
}
