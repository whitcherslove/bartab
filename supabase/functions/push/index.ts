// BarTab — пуш-уведомления о приглашении в компанию.
// POST { type: 'invite', crewId, invitee } — шлёт приглашённому, только если приглашение
// действительно только что отправил тот, кто вызывает функцию.
//
// Секреты (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:твоя@почта)
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Payload = { title: string; body: string; url: string; tag?: string };

// deno-lint-ignore no-explicit-any
async function sendPush(admin: any, userIds: string[], payload: Payload) {
  const pub = Deno.env.get('VAPID_PUBLIC_KEY'), priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv || !userIds.length) return 0;
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:bartab@example.com', pub, priv);
  const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds);
  let sent = 0;
  await Promise.all((data ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id); // устройство отписалось
      else console.error('push failed', code, (e as { body?: string }).body ?? String(e));
    }
  }));
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: auth } = await user.auth.getUser();
    if (!auth?.user) return json({ error: 'Нужно войти' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    if (body.type !== 'invite') return json({ error: 'Неизвестный тип' }, 400);
    const crewId = String(body.crewId ?? ''), invitee = String(body.invitee ?? '');

    // приглашение должно существовать, быть свежим и отправленным именно этим человеком
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: inv } = await admin.from('crew_invites').select('id')
      .eq('crew_id', crewId).eq('invitee', invitee).eq('inviter', auth.user.id).eq('status', 'pending').gte('created_at', since).maybeSingle();
    if (!inv) return json({ error: 'Приглашение не найдено' }, 404);

    const [{ data: crew }, { data: me }] = await Promise.all([
      admin.from('crews').select('name').eq('id', crewId).maybeSingle(),
      admin.from('profiles').select('name').eq('id', auth.user.id).maybeSingle(),
    ]);
    const sent = await sendPush(admin, [invitee], {
      title: 'Приглашение в компанию',
      body: `${me?.name || 'Тебя'} зовёт тебя в «${crew?.name ?? 'компанию'}»`,
      url: '/?tab=crew',
      tag: `invite-${inv.id}`,
    });
    return json({ sent });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
