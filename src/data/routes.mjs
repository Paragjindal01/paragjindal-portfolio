const DEMO_ALIASES = {
  relayops: '/relayops/',
  'relayops-ai': '/relayops/',
  computeflow: '/compute-flow/',
  'compute-flow': '/compute-flow/',
};

export function resolvePortfolioRoute(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const [section, slug] = segments;
  if (segments.length <= 2 && section === 'lab') {
    if (Object.hasOwn(DEMO_ALIASES, slug)) return { page: 'demo-redirect', href: DEMO_ALIASES[slug] };
    return { page: 'lab', slug: slug === 'infrapilot' ? 'infrapilot-ai' : slug };
  }
  if (segments.length <= 2 && section === 'case-studies') return { page: 'case-study', slug };
  if (segments.length === 1 && section === 'greeting') return { page: 'greeting' };
  return { page: 'portfolio' };
}
