// Модель данных. Названия совпадают с будущими таблицами в Supabase.

/** userId — аккаунт, если человек привязал себя («Это я») */
/** archived — удалён из компании, но остаётся в старых встречах */
export type Person = { id: string; name: string; tg: string; userId: string | null; avatar: string; archived?: boolean };

/** mapUrl — ссылка из Яндекс/Google Карт, lat/lon — точка на карте (если выбрали из поиска) */
/** category — бар, кинотеатр или другое (доставка, рестораны, магазины…) */
export type Place = { id: string; name: string; address: string; hue: number; photo: string; mapUrl: string; lat: number | null; lon: number | null; category: 'bar' | 'cinema' | 'other'; /** в каких моих компаниях место (только для показа) */ crewIds?: string[] };

export type Chat = { id: string; name: string; chatId: string };

/** equal — делим поровну между consumers; qty — по штукам из split */
export type SplitMode = 'equal' | 'qty';

export type Item = {
  id: string;
  name: string;
  price: number;
  qty: number;
  splitMode: SplitMode;
  consumers: string[];
  split: Record<string, number>;
  /** из какого чека пришла позиция (нет — добавлена вручную) */
  receiptId?: string;
};

/** Чек или скриншот билетов у встречи */
export type Receipt = {
  id: string;
  /** путь к фото в хранилище receipts */
  path: string;
  kind: 'receipt' | 'tickets';
  /** статус распознавания: ⏳ / ✅ / ⚠️ / ❌ … */
  status: string;
  createdAt: string;
};

/** sum — чаевые суммой, pct — процентом от счёта */
export type TipsMode = 'sum' | 'pct';

export type BarEvent = {
  id: string;
  date: string;
  placeId: string;
  members: string[];
  tips: number;
  tipsMode: TipsMode;
  /** валюта встречи, например RUB */
  currency: string;
  /** кто оплатил счёт бару */
  payer: string;
  /** кто уже перевёл свою часть плательщику */
  settled: string[];
  /** статус распознавания чека */
  status: string;
  /** путь к фото последнего чека в хранилище receipts ('' — нет) */
  receiptPath?: string;
  /** все чеки встречи, по порядку загрузки */
  receipts?: Receipt[];
  /** когда создана — для сортировки «новые сверху» */
  createdAt?: string;
  /** категория встречи (если место не выбрано — берётся отсюда) */
  category?: 'bar' | 'cinema' | 'other';
  /** кино: фильм, время сеанса, зал */
  film?: string;
  sessionTime?: string;
  hall?: string;
  items: Item[];
};

export type State = {
  /** id человека, который соответствует текущему аккаунту в этой компании ('' — ещё не выбран) */
  me: string;
  people: Person[];
  places: Place[];
  chats: Chat[];
  events: BarEvent[];
};
