export function resolvePortfolioRoute(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const [section, slug] = segments;
  if (segments.length <= 2 && section === 'lab') return { page: 'lab', slug };
  if (segments.length <= 2 && section === 'case-studies') return { page: 'case-study', slug };
  if (segments.length === 1 && section === 'greeting') return { page: 'greeting' };
  return { page: 'portfolio' };
}
