const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const Icon = {
  glass: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M6 4h10v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M16 8h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M6 8h10" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={2.2} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></svg>
  ),
  up: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={2.2} aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
  ),
  down: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={2.2} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={2} aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" {...s} strokeWidth={2} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
  ),
  cam: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><path d="M21 3L3 10.5l7 2.5 2.5 7z" /><path d="M10 13l11-10" /></svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" {...s} aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
  ),
};
