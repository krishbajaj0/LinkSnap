const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  link: 'M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2',
  chart: 'M3 3v18h18 M7 15l4-4 4 3 6-7',
  settings: 'M3 6h4m4 0h10M3 12h10m4 0h4M3 18h6m4 0h8M7 4v4m10 2v4m-8 2v4',
  shield: 'M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9z M9 12l2 2 4-4',
  menu: 'M4 6h16M4 12h16M4 18h16',
  chevron: 'm6 9 6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  download: 'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',
  visitors: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M20 21v-2a4 4 0 0 0-3-4M10 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m6 1a4 4 0 0 1 0 7',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  copy: 'M8 8h12v12H8zM16 4H4v12',
  external: 'M13 4h7v7m0-7-9 9m7 1v6H4V6h6',
  qr: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3v3h3v3m-6-1h.01 M12 3v2m0 5v4m-9-2h4m13-1v2',
  alert: 'M12 3 2 21h20L12 3z M12 9v5m0 3h.01',
  signout: 'M10 17l5-5-5-5m5 5H3m10-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
};

export default function Icon({ name, size = 18 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={name === 'more' ? 3.5 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}
