import { useUI } from '../lib/ui';
import { InstallAction } from '../components/InstallCard';

/** Шторка установки (из плашки или по ссылке «Позвать в BarTab») */
export function InstallSheet() {
  const ui = useUI();
  return (
    <div className="qr-sheet">
      <img src="/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
      <h4>Поставь BarTab на телефон</h4>
      <p className="hint welcome-text">Будет открываться с экрана, как обычное приложение.</p>
      <InstallAction onDone={() => ui.close()} />
    </div>
  );
}
