import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { tgBotName, tgFindChat } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { Icon } from '../components/Icons';

/** Одноразовый код: по нему находим чат, куда добавили бота */
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export function ConnectChatSheet() {
  const { refresh } = useStore();
  const ui = useUI();
  const [bot, setBot] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [code] = useState(makeCode);

  useEffect(() => {
    tgBotName().then(setBot).catch((e) => setError(humanError(e)));
  }, []);

  const command = bot ? `/connect@${bot} ${code}` : '';

  const check = async () => {
    setChecking(true);
    setError('');
    try {
      const res = await tgFindChat(code);
      if (!res.found) {
        setError('Пока не вижу. Убедись, что бот добавлен и в чате появилась команда с кодом, и проверь ещё раз через пару секунд.');
      } else {
        await refresh();
        ui.close();
        ui.toast(`Чат «${res.name}» подключён`);
        return;
      }
    } catch (e) {
      setError(humanError(e));
    }
    setChecking(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(command); ui.toast('Команда скопирована'); } catch { /* выделят вручную */ }
  };

  return (
    <>
      <h4>Подключить чат</h4>
      <ol className="steps">
        <li>Нажми кнопку и выбери групповой чат — бот добавится и сам отправит туда команду с кодом.</li>
        <li>Вернись сюда и нажми «Проверить».</li>
      </ol>
      <a
        className={'btn primary block' + (bot ? '' : ' disabled')}
        href={bot ? `https://t.me/${bot}?startgroup=${code}` : undefined}
        target="_blank"
        rel="noopener"
        aria-disabled={!bot}
      >
        {Icon.send} {bot ? 'Добавить бота в чат' : 'Загружаю…'}
      </a>
      <button className="btn block" style={{ marginTop: 10 }} onClick={check} disabled={checking || !bot}>
        {checking ? 'Проверяю…' : 'Проверить'}
      </button>
      {error && <p className="auth-err" style={{ marginTop: 12 }}>{error}</p>}
      {bot && (
        <div className="field" style={{ marginTop: 16 }}>
          <span>Бот уже в чате? Отправь туда эту команду и нажми «Проверить»</span>
          <div className="cmd-row">
            <code className="cmd">{command}</code>
            <button className="btn ghost sm" onClick={copy}>Копировать</button>
          </div>
        </div>
      )}
    </>
  );
}
