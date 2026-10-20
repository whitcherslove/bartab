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

/** Итоги в общий чат */
export function chatText(ev: BarEvent, placeName: string, name: NameOf) {
  return `🍻 ${placeName}, ${fdate(ev.date)}\nИтого: ${money(evWithTips(ev), ev.currency)}\n\n${ev.members.map((m) => lineFor(ev, m, name)).join('\n')}`;
}

/** Личное сообщение человеку */
export function personalText(ev: BarEvent, pid: string, placeName: string, name: NameOf) {
  const st = stats(ev, pid);
  const head = `🍻 ${placeName}, ${fdate(ev.date)}\n`;
  if (ev.payer && !st.isPayer && !st.settled) {
    return head + `С тебя ${money(st.owed, ev.currency)}. Перевод для: ${name(ev.payer)} 🙏`;
  }
  return head + lineFor(ev, pid, name);
}
