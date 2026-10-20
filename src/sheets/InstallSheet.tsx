import { useUI } from '../lib/ui';
import { InstallHelp } from '../components/InstallCard';

export function InstallSheet() {
  const ui = useUI();
  return (
    <div className="qr-sheet">
      <img src="/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
      <h4>Поставь BarTab на телефон</h4>
      <p className="hint" style={{ textAlign: 'center', margin: '0 0 16px' }}>Так его удобно открывать с экрана, как обычное приложение.</p>
      <InstallHelp compact />
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => ui.close()}>Позже</button>
    </div>
  );
}
