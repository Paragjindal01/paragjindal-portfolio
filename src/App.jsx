import { lazy, Suspense, useEffect } from 'react';
import { useMotionValue } from 'framer-motion';
import { resolvePortfolioRoute } from './data/routes.mjs';
import './engineering.css';

const HiggsfieldHome = lazy(() => import('./higgsfield/home/HiggsfieldHome.tsx'));
const LabShell = lazy(() => import('./lab/LabShell.jsx'));
const SplineHero = lazy(() => import('./components/SplineHero.jsx'));
const ProjectCaseStudy = lazy(() => import('./components/ProjectCaseStudy.jsx'));

function Greeting() {
  const position = useMotionValue(0);
  return <div className="engineering-site"><header className="site-header"><div className="site-frame site-topbar"><a className="site-brand" href="/"><img alt="" className="site-brand__logo" src="/assets/brand/logo.svg" width={35} height={35} />Parag Jindal</a><a href="/">Back to portfolio</a></div></header><main className="site-frame site-greeting"><h1>Interactive 3D greeting</h1><div className="site-spline"><Suspense fallback={<p role="status">Loading 3D greeting…</p>}><SplineHero smoothProgress={position} /></Suspense></div></main></div>;
}

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
  if (page === 'greeting') return <Greeting />;
  if (page === 'case-study') return <Suspense fallback={<p role="status">Loading case study…</p>}><ProjectCaseStudy slug={slug} /></Suspense>;
  if (page === 'demo-redirect') return <DemoRedirect href={href} />;
  return <Suspense fallback={<p role="status">Loading portfolio…</p>}><HiggsfieldHome /></Suspense>;
}
