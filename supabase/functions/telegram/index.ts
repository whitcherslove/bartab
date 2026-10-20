// BarTab — Telegram-бот.
// Действия (POST { action, ... }):
//   info                          → { username } — имя бота для ссылки «добавить в чат»
//   find_chat { code, crewId }    → находит чат, куда отправили /start@бот КОД или /connect@бот КОД,
//                                   делает его чатом компании и пишет в чат «подключён»
//   send { crewId, text }         → отправляет текст в чат компании
// У компании один чат, его видят и используют все участники.
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
      const crewId = String(body.crewId ?? '');
      if (!/^[A-Za-z0-9_-]{6,64}$/.test(code)) return json({ error: 'Неверный код' }, 400);
      // правила доступа вернут компанию, только если пользователь в ней состоит
      const { data: crew } = await db.from('crews').select('id, name, tg_chat_id').eq('id', crewId).maybeSingle();
      if (!crew) return json({ error: 'Компания не найдена' }, 404);

      const updates = await tg<TgUpdate[]>('getUpdates', { allowed_updates: ['message', 'channel_post'], limit: 100 });
      const re = new RegExp(`^/(start|connect)(@\\w+)?\\s+${code}\\s*$`);
      const hit = [...updates].reverse().map((u) => u.message ?? u.channel_post).find((m) => m?.text && re.test(m.text));
      if (!hit) return json({ found: false });

      const chatId = String(hit.chat.id);
      const name = hit.chat.title || (hit.chat.username ? '@' + hit.chat.username : hit.chat.first_name) || 'Чат';
      const { data: prof } = await db.from('profiles').select('name').eq('id', auth.user.id).maybeSingle();
      if (crew.tg_chat_id !== chatId) {
        const { error } = await db.from('crews').update({ tg_chat_id: chatId, tg_chat_name: name, tg_chat_by: prof?.name ?? '' }).eq('id', crewId);
        if (error) throw new Error('Не удалось сохранить чат: ' + error.message);
        await tg('sendMessage', { chat_id: chatId, text: `✅ Чат подключён к компании «${crew.name}» в BarTab. Сюда будут приходить итоги встреч 🍻` }).catch(() => {});
      }
      return json({ found: true, name });
    }

    if (action === 'send') {
      const crewId = String(body.crewId ?? '');
      const text = String(body.text ?? '').trim().slice(0, 4000);
      if (!crewId || !text) return json({ error: 'Нет компании или текста' }, 400);
      const { data: crew } = await db.from('crews').select('tg_chat_id, tg_chat_name').eq('id', crewId).maybeSingle();
      if (!crew) return json({ error: 'Компания не найдена' }, 404);
      if (!crew.tg_chat_id) return json({ error: 'У компании ещё нет Telegram-чата' }, 400);
      await tg('sendMessage', { chat_id: crew.tg_chat_id, text, disable_web_page_preview: true });
      return json({ ok: true, name: crew.tg_chat_name });
    }

    return json({ error: 'Неизвестное действие' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('telegram:', msg);
    return json({ error: msg }, 500);
  }
});
