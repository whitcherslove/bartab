import { useState } from 'react';
import { useStore } from '../lib/store';
import { useUI } from '../lib/ui';
import { chatText } from '../lib/messages';
import { Icon } from '../components/Icons';
import { tgSend } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { ConnectChatSheet } from './ConnectChatSheet';

export function ChatSheet({ eventId }: { eventId: string }) {
  const { state, nameOf } = useStore();
  const ui = useUI();
  const [chatId, setChatId] = useState(state.chats[0]?.id ?? '');
  const [sending, setSending] = useState(false);
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev) return null;

  const placeName = state.places.find((p) => p.id === ev.placeId)?.name ?? 'Посиделка';
  const preview = chatText(ev, placeName, nameOf);

  const send = async () => {
    setSending(true);
    try {
      const res = await tgSend(chatId, preview);
      ui.close();
      ui.toast(`Итоги отправлены в «${res.name}»`);
    } catch (e) {
      setSending(false);
      ui.toast(humanError(e));
    }
  };

  return (
    <>
      <h4>Отправить итоги в чат</h4>
      <div className="field">
        <span>Куда отправить</span>
        {state.chats.length === 0 && (
          <button className="btn block" onClick={() => ui.open(<ConnectChatSheet />)}>{Icon.plus} Подключить чат</button>
        )}
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
      <button className="btn primary block" onClick={send} disabled={!chatId || sending}>{Icon.send} {sending ? 'Отправляю…' : 'Отправить'}</button>
    </>
  );
}
