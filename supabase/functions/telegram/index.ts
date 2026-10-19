// BarTab — Telegram-бот.
// Действия (POST { action, ... }):
//   info                       → { username } — имя бота для ссылки «добавить в чат»
//   find_chat { code }         → находит чат, куда отправили /start@бот КОД или /connect@бот КОД,
//                                сохраняет его в «Мои чаты» пользователя и пишет в чат «подключён»
//   send { chatRowId, text }   → отправляет текст в один из чатов пользователя
//
// Секрет (Edge Functions → Secrets): TELEGRAM_BOT_TOKEN

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type TgChat = { id: number; title?: string; username?: string; first_name?: string; type: string };
type TgMessage = { text?: string; chat: TgChat };
type TgUpdate = { update_id: number; message?: TgMessage; channel_post?: TgMessage };

async function tg<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) throw new Error('Не задан секрет TELEGRAM_BOT_TOKEN');
  const resp = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await resp.json().catch(() => ({}));
  if (!data.ok) {
    const desc = String(data.description ?? resp.status);
    if (/chat not found|bot was kicked|not a member/i.test(desc)) throw new Error('Бот не состоит в этом чате. Добавь его заново.');
    if (/can't parse|webhook is active/i.test(desc)) throw new Error('Telegram: ' + desc);
    throw new Error('Telegram: ' + desc);
  }
  return data.result as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });

  try {
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return json({ error: 'Нужно войти в приложение' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    if (action === 'info') {
      const me = await tg<{ username: string }>('getMe');
      return json({ username: me.username });
    }

    if (action === 'find_chat') {
      const code = String(body.code ?? '').trim();
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) return json({ error: 'Неверный код' }, 400);
      const updates = await tg<TgUpdate[]>('getUpdates', { allowed_updates: ['message', 'channel_post'], limit: 100 });
      const re = new RegExp(`^/(start|connect)(@\\w+)?\\s+${code}\\s*$`);
      const hit = [...updates].reverse().map((u) => u.message ?? u.channel_post).find((m) => m?.text && re.test(m.text));
      if (!hit) return json({ found: false });

      const chatId = String(hit.chat.id);
      const name = hit.chat.title || (hit.chat.username ? '@' + hit.chat.username : hit.chat.first_name) || 'Чат';
      const { data: existing } = await db.from('tg_chats').select('id').eq('chat_id', chatId).maybeSingle();
      if (!existing) {
        const { error } = await db.from('tg_chats').insert({ name, chat_id: chatId });
        if (error) throw new Error('Не удалось сохранить чат: ' + error.message);
        await tg('sendMessage', { chat_id: chatId, text: '✅ Чат подключён к BarTab. Сюда будут приходить итоги посиделок 🍻' }).catch(() => {});
      }
      return json({ found: true, name });
    }

    if (action === 'send') {
      const chatRowId = String(body.chatRowId ?? '');
      const text = String(body.text ?? '').trim().slice(0, 4000);
      if (!chatRowId || !text) return json({ error: 'Нет чата или текста' }, 400);
      // только свои чаты: правила доступа вернут строку, лишь если она моя
      const { data: chat } = await db.from('tg_chats').select('chat_id, name').eq('id', chatRowId).maybeSingle();
      if (!chat) return json({ error: 'Чат не найден' }, 404);
      await tg('sendMessage', { chat_id: chat.chat_id, text, disable_web_page_preview: true });
      return json({ ok: true, name: chat.name });
    }

    return json({ error: 'Неизвестное действие' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('telegram:', msg);
    return json({ error: msg }, 500);
  }
});
