// Модель данных. Названия совпадают с будущими таблицами в Supabase.

/** userId — аккаунт, если человек привязал себя («Это я») */
/** archived — удалён из компании, но остаётся в старых встречах */
export type Person = { id: string; name: string; tg: string; userId: string | null; avatar: string; archived?: boolean };

/** mapUrl — ссылка из Яндекс/Google Карт, lat/lon — точка на карте (если выбрали из поиска) */
/** category — бар, кинотеатр или другое (доставка, рестораны, магазины…) */
export type Place = { id: string; name: string; address: string; hue: number; photo: string; mapUrl: string; lat: number | null; lon: number | null; category: 'bar' | 'cinema' | 'other' };

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
