import { useAccount } from '../lib/account';
import { useUI } from '../lib/ui';
import { CrewAvatar } from '../components/common';
import { InstallHelp } from '../components/InstallCard';

/** Приветствие после вступления по приглашению + установка на телефон */
export function WelcomeSheet() {
  const acc = useAccount();
  const ui = useUI();
  return (
    <div className="qr-sheet">
      <CrewAvatar crew={acc.crew} size={72} />
      <h4>Ты в компании «{acc.crew.name}» 🎉</h4>
      <p className="hint" style={{ textAlign: 'center', margin: '0 0 16px' }}>Поставь BarTab на экран телефона — так быстрее открывать посиделки и делить счёт.</p>
      <InstallHelp compact />
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => ui.close()}>Позже</button>
    </div>
  );
}
