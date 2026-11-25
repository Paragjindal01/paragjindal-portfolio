const paths = {
  brand: 'M3 4h8v8H3zM13 12h8v8h-8zM11 8h6v4M7 12v5h6',
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  studio: 'M3 3h6v6H3zM15 15h6v6h-6zM6 9v9h9M15 3h6v6h-6zM9 6h6',
  executions: 'M3 12h4l3-8 4 16 3-8h4',
  agents: 'M5 7h14v12H5zM12 7V3m-3 9h.01m6 0h.01M9 16h6M3 11v4m18-4v4',
  integrations: 'M12 3v5m-4-4v4m8-4v4M6 8h12v3a6 6 0 0 1-6 6v4m-6-13v3a6 6 0 0 0 6 6',
  evaluation: 'M4 19h16M7 15v-4m5 4V5m5 10V8',
  reports: 'M6 3h9l3 3v15H6zM14 3v5h5m-10 4h6m-6 4h6',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4M9 16v4',
  trigger: 'm13 2-9 12h7l-1 8 10-12h-7z',
  agent: 'M4 5h16v12h-6l-4 4v-4H4zM8 10h.01m4 0h.01m4 0h.01',
  api: 'm9 6-6 6 6 6m6-12 6 6-6 6M13 4l-2 16',
  transform: 'M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4',
  condition: 'M12 3 3 12l9 9 9-9zM9 12h6m-3-3v6',
  validate: 'm4 12 5 5L20 6',
  approval: 'M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6zM9 12l2 2 4-4',
  document: 'M6 3h9l3 3v15H6zM14 3v5h5m-10 4h6m-6 4h6',
  notification: 'M6 10a6 6 0 0 1 12 0c0 5 2 5 2 6H4c0-1 2-1 2-6m4 9a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  play: 'M8 5v14l12-7z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  chevron: 'm9 6 6 6-6 6',
  download: 'M12 4v11m-4-4 4 4 4-4M5 17v3h14v-3',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6M12 4l-2 16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2',
  minus: 'M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  menu: 'M4 6h16M4 12h16M4 18h16',
};

export default function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.studio} /></svg>;
}
