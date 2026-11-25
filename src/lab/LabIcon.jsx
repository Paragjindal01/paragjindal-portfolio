const paths = {
  rack: 'M4 3h16v18H4zM4 9h16M4 15h16M8 6h3m-3 6h3m-3 6h3M16 6h.01M16 12h.01M16 18h.01',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  power: 'm13 2-9 12h7l-1 8 10-12h-7z',
  spark: 'M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3m0-14-3 3m-8 8-3 3',
  network: 'M9 3h6v6H9zM3 15h6v6H3zm12 0h6v6h-6zM12 9v3M6 15v-3h12v3',
  server: 'M3 4h18v7H3zm0 9h18v7H3zm4-5h.01M7 16h.01m4-8h6m-6 8h6',
  storage: 'M4 6c0-2 4-4 8-4s8 2 8 4v12c0 2-4 4-8 4s-8-2-8-4zM4 6c0 2 4 4 8 4s8-2 8-4M4 12c0 2 4 4 8 4s8-2 8-4',
  book: 'M12 21c-3-2-6-3-10-2V4c4-1 7 0 10 2 3-2 6-3 10-2v15c-4-1-7 0-10 2zm0-15v15',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  back: 'M19 12H5m6-6-6 6 6 6',
  external: 'M13 5h6v6m0-6L9 15m8-2v6H5V7h6',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
};

export default function LabIcon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
