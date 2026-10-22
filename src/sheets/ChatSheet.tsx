import { useState } from 'react';
import { useAccount } from '../lib/account';
import { useStore } from '../lib/store';
import { catOf, eventCategory } from '../lib/categories';
import { useUI } from '../lib/ui';
import { chatText } from '../lib/messages';
import { Icon } from '../components/Icons';
import { tgSend } from '../lib/remote';
import { humanError } from '../lib/supabase';
import { ConnectChatSheet } from './ConnectChatSheet';

export function ChatSheet({ eventId }: { eventId: string }) {
  const { state, nameOf } = useStore();
  const ui = useUI();
  const acc = useAccount();
  const hasChat = !!acc.crew.tg_chat_id;
  const [sending, setSending] = useState(false);
  const ev = state.events.find((e) => e.id === eventId);
  if (!ev) return null;

  const placeName = state.places.find((p) => p.id === ev.placeId)?.name ?? 'Встреча';
  const preview = chatText(ev, placeName, nameOf, catOf(eventCategory(ev, state.places)).emoji);

  const send = async () => {
    setSending(true);
    try {
      const res = await tgSend(acc.crew.id, preview);
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
        {hasChat ? (
          <div className="chat-target">{Icon.send} {acc.crew.tg_chat_name}</div>
        ) : (
          <>
            <p className="hint" style={{ margin: '0 0 10px' }}>У компании ещё нет Telegram-чата. Подключи его один раз — и итоги сможет отправлять любой участник.</p>
            <button className="btn block" onClick={() => ui.open(<ConnectChatSheet />)}>{Icon.plus} Подключить чат</button>
          </>
        )}
      </div>
      <div className="field">
        <span>Сообщение</span>
        <div className="preview">{preview}</div>
      </div>
      <button className="btn primary block" onClick={send} disabled={!hasChat || sending}>{Icon.send} {sending ? 'Отправляю…' : 'Отправить'}</button>
    </>
  );
}
