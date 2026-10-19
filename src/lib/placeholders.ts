// Иллюстрации-заглушки для баров без своего фото.
// Нарисованы для BarTab, у каждого бара своя (зависит от его id), оттенок фона — от цвета бара.

const C = { ink: '#1D2623', foam: '#FFF6E8', amber: '#F2A340', cherry: '#B5303A', lime: '#9BC53D', glass: 'rgba(255,246,232,.18)' };

/** hsl → #rrggbb (так цвет поймёт любой просмотрщик SVG) */
function hex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const bg = (h: number) => `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${hex(h, 45, 32)}"/><stop offset="1" stop-color="${hex((h + 35) % 360, 40, 15)}"/>
  </linearGradient></defs>
  <rect width="400" height="200" fill="url(#g)"/>`;

const pint = (x: number, y: number, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 10 H44 L39 80 Q38 88 30 88 H14 Q6 88 5 80 Z" fill="${C.amber}"/>
    <path d="M-4 12 Q-6 -2 8 -1 Q12 -11 23 -7 Q33 -13 39 -2 Q50 -3 48 12 Z" fill="${C.foam}"/>
    <circle cx="16" cy="40" r="3" fill="${C.foam}" opacity=".5"/><circle cx="28" cy="58" r="2.2" fill="${C.foam}" opacity=".45"/>
  </g>`;

const scenes: ((h: number) => string)[] = [
  // 1. Краны у стойки
  (h) => `${bg(h)}
    <rect x="0" y="150" width="400" height="50" fill="${C.ink}" opacity=".85"/>
    <rect x="60" y="60" width="280" height="14" rx="7" fill="${C.ink}"/>
    ${[100, 160, 220, 280].map((x, i) => `
      <rect x="${x - 6}" y="${i % 2 ? 22 : 28}" width="12" height="${i % 2 ? 40 : 34}" rx="6" fill="${i === 1 ? C.amber : i === 3 ? C.cherry : C.foam}"/>
      <rect x="${x - 4}" y="74" width="8" height="22" fill="${C.ink}"/>`).join('')}
    ${pint(138, 76, 0.84)}${pint(258, 76, 0.84)}`,

  // 2. Неоновая вывеска
  (h) => `${bg(h)}
    <rect x="120" y="40" width="160" height="110" rx="18" fill="none" stroke="${C.amber}" stroke-width="6" opacity=".9"/>
    <rect x="120" y="40" width="160" height="110" rx="18" fill="none" stroke="${C.amber}" stroke-width="16" opacity=".15"/>
    <path d="M172 72 H228 L214 108 Q212 116 204 116 H196 Q188 116 186 108 Z" fill="none" stroke="${C.foam}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M200 116 V132 M184 134 H216" stroke="${C.foam}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="222" cy="66" r="7" fill="${C.cherry}"/>
    <path d="M150 40 V14 M250 40 V14" stroke="${C.ink}" stroke-width="3"/>`,

  // 3. Три коктейля
  (h) => `${bg(h)}
    <rect x="0" y="160" width="400" height="40" fill="${C.ink}" opacity=".85"/>
    ${[[110, C.cherry], [200, C.amber], [290, C.lime]].map(([x, col]) => `
      <path d="M${Number(x) - 34} 60 H${Number(x) + 34} L${x} 108 Z" fill="${col}"/>
      <path d="M${Number(x) - 34} 60 H${Number(x) + 34}" stroke="${C.foam}" stroke-width="3" opacity=".5"/>
      <rect x="${Number(x) - 3}" y="106" width="6" height="44" fill="${C.foam}" opacity=".8"/>
      <rect x="${Number(x) - 22}" y="148" width="44" height="7" rx="3.5" fill="${C.foam}" opacity=".8"/>`).join('')}
    <path d="M196 40 L222 66" stroke="${C.foam}" stroke-width="3" stroke-linecap="round"/><circle cx="220" cy="62" r="8" fill="${C.cherry}"/>`,

  // 4. Полка с бутылками
  (h) => `${bg(h)}
    <rect x="40" y="108" width="320" height="8" fill="${C.ink}"/><rect x="40" y="170" width="320" height="8" fill="${C.ink}"/>
    ${[60, 92, 124, 156, 188, 220, 252, 284, 316].map((x, i) => {
      const t = 40 + (i * 13) % 26, col = [C.amber, C.lime, C.cherry, C.foam][i % 4];
      return `<path d="M${x} 108 V${t + 30} Q${x} ${t + 18} ${x + 7} ${t + 14} V${t} H${x + 13} V${t + 14} Q${x + 20} ${t + 18} ${x + 20} ${t + 30} V108 Z" fill="${col}" opacity="${0.75 + (i % 3) * 0.08}"/>`;
    }).join('')}
    ${[70, 130, 190, 250, 310].map((x) => `<rect x="${x}" y="132" width="26" height="38" rx="5" fill="${C.glass}" stroke="${C.foam}" stroke-opacity=".4"/>`).join('')}`,

  // 5. Гирлянда над столиками
  (h) => `${bg(h)}
    <path d="M0 30 Q100 80 200 40 T400 36" stroke="${C.ink}" stroke-width="2.5" fill="none"/>
    ${[30, 70, 110, 150, 190, 230, 270, 310, 350].map((x, i) => {
      const y = i < 5 ? 30 + Math.sin((x / 200) * Math.PI) * 26 : 40 + Math.sin(((x - 200) / 200) * Math.PI) * 10;
      return `<circle cx="${x}" cy="${y + 10}" r="7" fill="${C.amber}"/><circle cx="${x}" cy="${y + 10}" r="15" fill="${C.amber}" opacity=".16"/>`;
    }).join('')}
    ${[100, 300].map((x) => `<rect x="${x - 55}" y="140" width="110" height="10" rx="5" fill="${C.ink}"/><rect x="${x - 4}" y="150" width="8" height="40" fill="${C.ink}"/>`).join('')}
    ${pint(70, 82, 0.62)}${pint(290, 82, 0.62)}`,

  // 6. Чокаются две пинты
  (h) => `${bg(h)}
    <g transform="rotate(-10 170 120)">${pint(130, 70, 1)}</g>
    <g transform="rotate(10 230 120)">${pint(222, 70, 1)}</g>
    <path d="M200 44 V24 M182 50 L170 34 M218 50 L230 34" stroke="${C.foam}" stroke-width="5" stroke-linecap="round"/>`,
];

const cache = new Map<string, string>();

function seedOf(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

/** Картинка-заглушка (data:image/svg+xml) для бара */
export function placeholderFor(key: string, hue: number): string {
  const k = `${key}|${hue}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">${scenes[seedOf(key) % scenes.length](hue)}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`;
  cache.set(k, url);
  return url;
}

export const SCENE_COUNT = scenes.length;

// ---------- Квадратные заглушки для аватарок компаний ----------

const sqBg = (h: number) => `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${hex(h, 50, 40)}"/><stop offset="1" stop-color="${hex((h + 40) % 360, 45, 20)}"/>
  </linearGradient></defs>
  <rect width="200" height="200" fill="url(#g)"/>`;

const shot = (x: number, y: number, col: string) => `
  <path d="M${x} ${y} H${x + 26} L${x + 22} ${y + 34} H${x + 4} Z" fill="${C.glass}" stroke="${C.foam}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M${x + 2} ${y + 10} H${x + 24} L${x + 22} ${y + 34} H${x + 4} Z" fill="${col}"/>`;

const crewScenes: ((h: number) => string)[] = [
  // три пинты чокаются
  (h) => `${sqBg(h)}
    <g transform="rotate(-14 70 120)">${pint(48, 70, 0.8)}</g>
    <g>${pint(82, 62, 0.8)}</g>
    <g transform="rotate(14 130 120)">${pint(116, 70, 0.8)}</g>
    <path d="M100 40 V24 M84 46 L74 32 M116 46 L126 32" stroke="${C.foam}" stroke-width="4.5" stroke-linecap="round"/>`,
  // пиво и коктейль
  (h) => `${sqBg(h)}
    <g transform="rotate(-10 80 120)">${pint(48, 64, 0.95)}</g>
    <g transform="rotate(10 140 120)">
      <path d="M104 72 H168 L136 112 Z" fill="${C.cherry}"/>
      <rect x="133" y="110" width="6" height="40" fill="${C.foam}"/><rect x="116" y="148" width="40" height="7" rx="3.5" fill="${C.foam}"/>
      <path d="M128 52 L150 74" stroke="${C.foam}" stroke-width="3" stroke-linecap="round"/><circle cx="148" cy="70" r="7" fill="${C.amber}"/>
    </g>`,
  // шоты в ряд
  (h) => `${sqBg(h)}
    <rect x="20" y="140" width="160" height="8" rx="4" fill="${C.ink}" opacity=".7"/>
    ${shot(30, 104, C.amber)}${shot(67, 104, C.lime)}${shot(104, 104, C.cherry)}${shot(141, 104, C.amber)}
    <path d="M100 52 L100 78 M86 58 L80 70 M114 58 L120 70" stroke="${C.foam}" stroke-width="4" stroke-linecap="round"/>`,
  // дартс
  (h) => `${sqBg(h)}
    <circle cx="100" cy="100" r="62" fill="${C.ink}"/>
    <circle cx="100" cy="100" r="50" fill="${C.foam}"/><circle cx="100" cy="100" r="38" fill="${C.cherry}"/>
    <circle cx="100" cy="100" r="26" fill="${C.foam}"/><circle cx="100" cy="100" r="13" fill="${C.amber}"/>
    <path d="M100 100 L150 50" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M144 48 L160 40 L152 56 Z" fill="${C.lime}"/>`,
  // бутылка и бокалы
  (h) => `${sqBg(h)}
    <path d="M86 150 V92 Q86 80 94 74 V40 H106 V74 Q114 80 114 92 V150 Z" fill="${C.lime}" opacity=".9"/>
    <rect x="92" y="100" width="16" height="22" rx="3" fill="${C.foam}" opacity=".8"/>
    ${pint(30, 86, 0.6)}${pint(142, 86, 0.6)}`,
  // гирлянда и кружки
  (h) => `${sqBg(h)}
    <path d="M0 40 Q100 90 200 40" stroke="${C.ink}" stroke-width="2.5" fill="none"/>
    ${[22, 60, 100, 140, 178].map((x) => { const y = 40 + Math.sin((x / 200) * Math.PI) * 25; return `<circle cx="${x}" cy="${y + 9}" r="7" fill="${C.amber}"/><circle cx="${x}" cy="${y + 9}" r="15" fill="${C.amber}" opacity=".16"/>`; }).join('')}
    ${pint(56, 96, 0.7)}${pint(110, 96, 0.7)}`,
];

const crewCache = new Map<string, string>();

/** Квадратная картинка-заглушка для аватарки компании */
export function crewPlaceholderFor(key: string): string {
  const hit = crewCache.get(key);
  if (hit) return hit;
  const seed = seedOf(key);
  const hue = seed % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${crewScenes[(seed >> 3) % crewScenes.length](hue)}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' '))}`;
  crewCache.set(key, url);
  return url;
}

export const crewSceneSvg = (i: number, hue: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${crewScenes[i](hue)}</svg>`;
export const CREW_SCENE_COUNT = crewScenes.length;

/** Для проверки: SVG конкретной сцены */
export const sceneSvg = (i: number, hue: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice">${scenes[i](hue)}</svg>`;


// ---------- Круглые заглушки для людей без фото ----------
// Простые значки, чтобы читались даже в маленьком кружке 22 px.

const personIcons: string[] = [
  // пинта
  `<path d="M32 34 H64 L60 78 Q59 82 55 82 H41 Q37 82 36 78 Z" fill="${C.amber}"/><path d="M29 36 Q28 24 38 25 Q41 18 49 20 Q57 16 61 24 Q70 23 67 36 Z" fill="${C.foam}"/>`,
  // коктейль
  `<path d="M24 30 H76 L50 58 Z" fill="${C.cherry}"/><rect x="47" y="56" width="6" height="20" fill="${C.foam}"/><rect x="36" y="74" width="28" height="6" rx="3" fill="${C.foam}"/><circle cx="66" cy="28" r="7" fill="${C.lime}"/>`,
  // бокал вина
  `<path d="M34 22 H66 Q68 52 50 56 Q32 52 34 22 Z" fill="${C.foam}" opacity=".35"/><path d="M35 36 H65 Q64 52 50 55 Q36 52 35 36 Z" fill="${C.cherry}"/><rect x="47" y="55" width="6" height="20" fill="${C.foam}"/><rect x="36" y="74" width="28" height="6" rx="3" fill="${C.foam}"/>`,
  // шот
  `<path d="M34 30 H66 L61 76 H39 Z" fill="${C.foam}" opacity=".3" stroke="${C.foam}" stroke-width="3" stroke-linejoin="round"/><path d="M36 46 H64 L61 76 H39 Z" fill="${C.amber}"/>`,
  // долька лайма
  `<path d="M22 60 A28 28 0 0 1 78 60 Z" fill="${C.lime}"/><path d="M28 60 A22 22 0 0 1 72 60 Z" fill="${C.foam}" opacity=".6"/><path d="M50 60 V40 M50 60 L36 46 M50 60 L64 46" stroke="${C.lime}" stroke-width="3"/>`,
  // вишенки
  `<path d="M40 64 Q46 36 62 26 M60 64 Q58 42 62 26" stroke="${C.foam}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="38" cy="66" r="12" fill="${C.cherry}"/><circle cx="62" cy="66" r="12" fill="${C.cherry}"/><circle cx="34" cy="62" r="3" fill="${C.foam}" opacity=".7"/>`,
  // крендель
  `<path d="M50 70 C20 50 26 26 40 28 C52 30 50 46 50 46 C50 46 48 30 60 28 C74 26 80 50 50 70 Z M38 62 L62 46 M62 62 L38 46" stroke="${C.amber}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  // бутылка
  `<path d="M42 82 V48 Q42 40 46 36 V18 H54 V36 Q58 40 58 48 V82 Z" fill="${C.lime}"/><rect x="44" y="54" width="12" height="14" rx="2" fill="${C.foam}" opacity=".85"/>`,
];

const personCache = new Map<string, string>();

/** Круглая картинка-заглушка для человека (ключ — id аккаунта или человека) */
export function personPlaceholderFor(key: string): string {
  const hit = personCache.get(key);
  if (hit) return hit;
  const seed = seedOf(key);
  const h = (seed >> 5) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(h, 45, 42)}"/><stop offset="1" stop-color="${hex((h + 30) % 360, 40, 26)}"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/>${personIcons[seed % personIcons.length]}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  personCache.set(key, url);
  return url;
}

export const personIconSvg = (i: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hex(h, 45, 42)}"/><stop offset="1" stop-color="${hex((h + 30) % 360, 40, 26)}"/></linearGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/>${personIcons[i]}</svg>`;
export const PERSON_ICON_COUNT = personIcons.length;
