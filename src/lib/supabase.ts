import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Если переменные не заданы — приложение покажет понятную ошибку вместо белого экрана */
export const configError =
  !url || !key ? 'Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY. Проверь файл .env.local (локально) или Environment Variables (Vercel).' : '';

export const supabase = createClient(url || 'http://localhost', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Понятные сообщения для частых ошибок Supabase */
export function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  if (/rate limit|over_email_send_rate_limit|security purposes/i.test(msg)) return 'Слишком много писем подряд. Подожди минуту и попробуй снова.';
  if (/expired|invalid/i.test(msg) && /token|otp|code/i.test(msg)) return 'Код неверный или устарел. Запроси новое письмо.';
  if (/Приглашение не найдено/.test(msg)) return 'Приглашение не найдено. Проверь код или ссылку.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Нет связи с сервером. Проверь интернет.';
  return msg;
}
