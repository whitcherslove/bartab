// BarTab — распознавание чека.
// Принимает { eventId, path } (фото уже лежит в хранилище receipts),
// отправляет фото в Gemini и записывает позиции в посиделку.
//
// Секреты (Edge Functions → Secrets):
//   GEMINI_API_KEY          — обязательно
//   GEMINI_MODEL            — основная модель (по умолчанию gemini-3.5-flash-lite)
//   GEMINI_FALLBACK_MODEL   — запасная модель (по умолчанию gemini-3.8-flash)

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite';
const FALLBACK = Deno.env.get('GEMINI_FALLBACK_MODEL') || 'gemini-3.8-flash';
const MAX_RETRIES = 2; // попыток на модель
const TIME_BUDGET_MS = 60_000; // общий лимит на распознавание

type Receipt = {
  items?: { name?: string; qty?: number; unit_price?: number; line_total?: number }[];
  service_charge?: number;
  total?: number;
};

const fmt = (n: number) => Math.round(n).toLocaleString('ru-RU');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Работаем от имени пользователя: правила доступа базы проверяют, что посиделка его
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const db = createClient(Deno.env.get('SUPABASE_URL')!, key, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });

  let eventId = '';
  try {
    const body = await req.json().catch(() => ({}));
    eventId = String(body.eventId ?? '');
    const path = String(body.path ?? '');
    if (!eventId || !path) return json({ error: 'Нет eventId или path' }, 400);

    const { data: ev, error: evErr } = await db
      .from('events')
      .select('id, crew_id')
      .eq('id', eventId)
      .single();
    if (evErr || !ev) return json({ error: 'Посиделка не найдена или нет доступа' }, 404);
    if (!path.startsWith(`${ev.crew_id}/`)) return json({ error: 'Фото не из этой компании' }, 403);

    await db.from('events').update({ status: '⏳ Распознаю чек…', receipt_path: path }).eq('id', eventId);

    const { data: file, error: fileErr } = await db.storage.from('receipts').download(path);
    if (fileErr || !file) throw new Error('Не удалось прочитать фото: ' + (fileErr?.message ?? 'нет файла'));
    const bytes = new Uint8Array(await file.arrayBuffer());

    const receipt = await parseWithGemini(bytes, file.type || 'image/jpeg');
    const rows = normalize(receipt);
    if (!rows.length) throw new Error('Не нашёл позиций на фото. Попробуй сфотографировать чек ровнее и ближе.');

    // Позиции добавляются без людей — кто что пил, отмечают в приложении
    const items = rows.map((r) => ({ id: crypto.randomUUID(), event_id: eventId, name: r.name, price: r.price, qty: r.qty, split_mode: 'equal' }));
    const { error: itemsErr } = await db.from('items').insert(items);
    if (itemsErr) throw new Error('Не удалось сохранить позиции: ' + itemsErr.message);

    // Сверка с итогом чека
    const sum = rows.reduce((s, r) => s + r.price * r.qty, 0);
    const total = Number(receipt.total) || 0;
    let status = `✅ Распознано позиций: ${rows.length}, на ${fmt(sum)}`;
    if (total > 0 && Math.abs(total - sum) > Math.max(1, total * 0.01)) {
      status = `⚠️ Распознано ${rows.length} поз. на ${fmt(sum)}, а итог чека ${fmt(total)}: проверь цены и количество`;
    } else if (total > 0) {
      status += ', совпадает с итогом чека';
    }
    await db.from('events').update({ status }).eq('id', eventId);

    return json({ count: rows.length, sum, total, status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('parse-receipt:', msg);
    if (eventId) await db.from('events').update({ status: '❌ ' + msg.slice(0, 180) }).eq('id', eventId);
    return json({ error: msg }, 500);
  }
});

/** Приводим ответ модели к аккуратным строкам */
function normalize(r: Receipt) {
  const list = [...(r.items ?? [])];
  if (Number(r.service_charge) > 0) list.push({ name: 'Сервисный сбор', qty: 1, unit_price: Number(r.service_charge) });
  return list
    .map((it) => {
      const rawQty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      const unit = Number(it.unit_price);
      const line = Number(it.line_total);
      const name = String(it.name ?? 'Позиция').trim().slice(0, 120) || 'Позиция';
      // Дробное количество (0,5 порции, 0,25 кг) — одна позиция на сумму строки
      if (!Number.isInteger(rawQty)) {
        const total = line > 0 ? line : unit * rawQty;
        return { name, qty: 1, price: Math.round(total * 100) / 100 };
      }
      const qty = Math.max(1, rawQty);
      const price = unit > 0 ? unit : line > 0 ? line / qty : 0;
      return { name, qty, price: Math.round(price * 100) / 100 };
    })
    .filter((r) => r.price > 0);
}

function toBase64(bytes: Uint8Array) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

const PROMPT = [
  'Это фото чека из бара или ресторана. Извлеки все позиции.',
  'Верни только JSON такого вида:',
  '{"items":[{"name":"","qty":1,"unit_price":0,"line_total":0}],"service_charge":0,"total":0}',
  'Правила:',
  '- name: название позиции как в чеке, кратко;',
  '- qty: количество (число), unit_price: цена за единицу, line_total: сумма строки;',
  '- если скидка относится к конкретной строке — учти её в цене этой строки;',
  '- service_charge: сервисный сбор суммой, если есть, иначе 0;',
  '- total: итог к оплате;',
  '- НЕ добавляй в items строки итогов, налогов, сдачи, чаевых и способов оплаты;',
  '- числа без валюты, десятичный разделитель — точка.',
].join('\n');

/** Gemini с повторами при перегрузке и запасной моделью */
async function parseWithGemini(bytes: Uint8Array, mime: string): Promise<Receipt> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Не задан секрет GEMINI_API_KEY');

  const payload = JSON.stringify({
    contents: [{ parts: [{ inline_data: { mime_type: mime, data: toBase64(bytes) } }, { text: PROMPT }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingLevel: 'low' } },
  });

  const started = Date.now();
  let lastError = '';
  for (const model of [MODEL, FALLBACK].filter((m, i, a) => m && a.indexOf(m) === i)) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (Date.now() - started > TIME_BUDGET_MS) throw new Error('Распознавание заняло слишком долго. ' + lastError);
      const t0 = Date.now();
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
      });
      console.log(`${model} попытка ${attempt}: ${resp.status} за ${Math.round((Date.now() - t0) / 1000)} с`);

      if (resp.ok) {
        const data = await resp.json();
        const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (!text) throw new Error('Пустой ответ модели');
        return JSON.parse(text.replace(/```json|```/g, '').trim());
      }

      lastError = `${model} ${resp.status}: ${(await resp.text()).slice(0, 160)}`;
      if (![429, 500, 503].includes(resp.status)) break; // повтор не поможет — следующая модель
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }
  throw new Error('Gemini недоступен. ' + lastError);
}
