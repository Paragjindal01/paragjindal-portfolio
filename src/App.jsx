import { lazy, Suspense, useEffect } from 'react';
import { resolvePortfolioRoute } from './data/routes.mjs';
import './engineering.css';

const HiggsfieldHome = lazy(() => import('./higgsfield/home/HiggsfieldHome.tsx'));
const LabShell = lazy(() => import('./lab/LabShell.jsx'));
const GreetingPage = lazy(() => import('./components/GreetingPage.jsx'));
const ProjectCaseStudy = lazy(() => import('./components/ProjectCaseStudy.jsx'));

function DemoRedirect({ href }) {
  const destination = href + window.location.search + window.location.hash;
  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);
  return <a href={destination}>Open demo</a>;
}

export default function App() {
  const { page, slug, href } = resolvePortfolioRoute(window.location.pathname);
  if (page === 'lab') return <Suspense fallback={<p role="status">Loading engineering lab…</p>}><LabShell slug={slug} /></Suspense>;
  if (page === 'greeting') return <Suspense fallback={<p role="status">Loading greeting…</p>}><GreetingPage /></Suspense>;
  if (page === 'case-study') return <Suspense fallback={<p role="status">Loading case study…</p>}><ProjectCaseStudy slug={slug} /></Suspense>;
  if (page === 'demo-redirect') return <DemoRedirect href={href} />;
  return <Suspense fallback={<p role="status">Loading portfolio…</p>}><HiggsfieldHome /></Suspense>;
}
