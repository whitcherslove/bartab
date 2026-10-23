import { useEffect, useState } from 'react';
import { useUI } from '../lib/ui';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { humanError } from '../lib/supabase';
import { done } from '../lib/motion';

/** Включить / выключить пуш-уведомления на этом устройстве */
export function PushCard() {
  const ui = useUI();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setSt).catch(() => setSt('unsupported')); }, []);
  if (!st || st === 'no-key') return null;

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    try { const s = await fn(); setSt(s); if (s === 'on' || s === 'off') done(); } catch (e) { ui.fail(humanError(e)); }
    setBusy(false);
  };

  return (
    <>
      <h3>Уведомления</h3>
      <div className="list form-card">
        {st === 'on' && (
          <div className="push-on">
            <div className="push-on-text">
              <b>🔔 Включены на этом устройстве</b>
              <span>Приглашения в компании и распознанные чеки</span>
            </div>
            <button className="btn sm push-off-btn" disabled={busy} onClick={() => run(disablePush)}>Выключить</button>
          </div>
        )}
        {st === 'off' && (
          <div className="install-help">
            <span>Пришлём, когда тебя позовут в компанию или распознают чек во встрече.</span>
            <button className="btn primary block" disabled={busy} onClick={() => run(enablePush)}>Включить уведомления</button>
          </div>
        )}
        {st === 'denied' && <div className="install-help"><b>Уведомления запрещены</b><span>Разреши их в настройках сайта или приложения на телефоне, потом вернись сюда.</span></div>}
        {st === 'need-install' && <div className="install-help"><b>Только в установленном приложении</b><span>На iPhone уведомления работают, если открыть BarTab с экрана «Домой».</span></div>}
        {st === 'unsupported' && <div className="install-help"><span>Этот браузер не поддерживает уведомления.</span></div>}
      </div>
    </>
  );
}
