import { useState } from 'react';
import { useUI } from '../lib/ui';
import { enablePush } from '../lib/push';
import { humanError } from '../lib/supabase';

/** Мягкий вопрос про уведомления — системный запрос только по кнопке «Включить» */
export function PushAskSheet() {
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  const enable = async () => {
    setBusy(true);
    try {
      const st = await enablePush();
      ui.close();
      ui.toast(st === 'on' ? 'Уведомления включены 🔔' : 'Можно включить позже в профиле');
    } catch (e) {
      ui.close();
      ui.fail(humanError(e));
    }
  };
  return (
    <div className="qr-sheet">
      <div className="push-bell" aria-hidden="true">🔔</div>
      <h4>Включить уведомления?</h4>
      <p className="hint welcome-text">Сообщим, когда тебя позовут в компанию или распознают чек во встрече. Без спама.</p>
      <button className="btn primary block" disabled={busy} onClick={enable}>Включить</button>
      <button className="link-btn install-later" onClick={() => ui.close()}>Не сейчас</button>
      <p className="hint" style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 12 }}>Включить или выключить можно в любой момент в профиле.</p>
    </div>
  );
}
