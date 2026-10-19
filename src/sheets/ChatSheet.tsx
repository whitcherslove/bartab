import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { chatText } from '../lib/messages';
import { Icon } from '../components/Icons';

// Пока имитация. На этапе 7 здесь будет вызов серверной функции send-telegram.
export function ChatSheet({ eventId }: { eventId: string }) {
  const { state, nameOf } = useStore();
  const ui = useUI();
  const [chatId, setChatId] = useState(state.chats[0]?.id ?? '');
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev) return null;

  const placeName = state.places.find((p) => p.id === ev.placeId)?.name ?? 'Посиделка';
  const preview = chatText(ev, placeName, nameOf);

  const send = () => {
    const chat = state.chats.find((c) => c.id === chatId);
    ui.close();
    ui.toast(`Итоги отправлены в «${chat?.name ?? 'чат'}»`);
  };

  return (
    <>
      <h4>Отправить итоги в чат</h4>
      <div className="field">
        <span>Куда отправить</span>
        {state.chats.length === 0 && <p className="hint" style={{ margin: 0 }}>Чатов пока нет: подключим их на этапе с Telegram.</p>}
        <div className="chips">
          {state.chats.map((c) => (
            <button key={c.id} type="button" className="chip plain" aria-pressed={c.id === chatId} onClick={() => setChatId(c.id)}>{c.name}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Сообщение</span>
        <div className="preview">{preview}</div>
      </div>
      <button className="btn primary block" onClick={send} disabled={!chatId}>{Icon.send} Отправить</button>
    </>
  );
}
