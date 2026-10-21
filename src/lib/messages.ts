import type { BarEvent } from './types';
import { evWithTips, stats } from './calc';
import { fdate, money } from './format';

type NameOf = (id: string) => string;

/** Строка человека для итогов */
export function lineFor(ev: BarEvent, pid: string, name: NameOf) {
  const st = stats(ev, pid);
  let tail = '';
  if (ev.payer) {
    if (st.isPayer) tail = ' — оплата счёта' + (st.balance > 1 ? `, ждёт ${money(st.balance, ev.currency)}` : ', все переводы получены ✅');
    else tail = st.settled ? ' — переведено ✅' : ` → перевод для: ${name(ev.payer)}`;
  }
  return `${name(pid)}: ${money(st.owed, ev.currency)}${tail}`;
}

/** Итоги в общий чат — коротко: кто кому сколько переводит */
export function chatText(ev: BarEvent, placeName: string, name: NameOf, emoji = '🍺') {
  const head = `${emoji} ${placeName}, ${fdate(ev.date)} · ${money(evWithTips(ev), ev.currency)}`;
  if (!ev.payer) {
    const parts = ev.members.map((m) => `${name(m)}: ${money(stats(ev, m).owed, ev.currency)}`);
    return `${head}\n\n${parts.join('\n')}`;
  }
  const lines = ev.members
    .filter((m) => m !== ev.payer && stats(ev, m).owed >= 1)
    .map((m) => `${name(m)} → ${name(ev.payer)}: ${money(stats(ev, m).owed, ev.currency)}${ev.settled.includes(m) ? ' ✅' : ''}`);
  return lines.length ? `${head}\n\n${lines.join('\n')}` : `${head}\n\nВсе в расчёте ✅`;
}

/** Личное сообщение человеку */
export function personalText(ev: BarEvent, pid: string, placeName: string, name: NameOf, emoji = '🍺') {
  const st = stats(ev, pid);
  const head = `${emoji} ${placeName}, ${fdate(ev.date)}\n`;
  const m = (n: number) => money(n, ev.currency);

  // тот, кто оплатил счёт
  if (ev.payer && st.isPayer) {
    const waiting = ev.members.filter((x) => x !== pid && !ev.settled.includes(x) && stats(ev, x).owed >= 1);
    const lines = [`Счёт ${m(evWithTips(ev))} оплачен тобой`, `Твоя часть: ${m(st.owed)}`];
    if (waiting.length) {
      lines.push(`Ждёшь переводов: ${m(st.balance)}`);
      lines.push(`Ещё не перевели: ${waiting.map((x) => `${name(x)} ${m(stats(ev, x).owed)}`).join(', ')}`);
    } else {
      lines.push('Все переводы получены ✅');
    }
    return head + lines.join('\n');
  }

  // ещё нужно перевести
  if (ev.payer && !st.settled && st.owed >= 1) return head + `С тебя ${m(st.owed)} → ${name(ev.payer)} 🙏`;

  // уже перевёл или плательщик не отмечен
  return head + `Твоя часть: ${m(st.owed)}${ev.payer && st.settled ? ' · перевод отмечен ✅' : ''}`;
}
