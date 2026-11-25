import { lazy, Suspense, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import ContactSection from './components/ContactSection.jsx';
import ProfessionalExperience from './components/ProfessionalExperience.jsx';
import { CONTACT, CURRENT_ROLE, EDUCATION, POSITIONING, TECHNOLOGIES, employmentMonth } from './data/professional.mjs';
import { EXPERTISE, FEATURED_LAB_IDS, GITHUB, LAB_PROJECTS, NAVIGATION, RELAYOPS, SELECTED_SOFTWARE } from './data/projects.mjs';
import { resolvePortfolioRoute } from './data/routes.mjs';
import LabIcon from './lab/LabIcon.jsx';
import relayStudioScreenshot from '../relayops-ai/docs/screenshots/studio.webp';
import './engineering.css';

const LabShell = lazy(() => import('./lab/LabShell.jsx'));
const SplineHero = lazy(() => import('./components/SplineHero.jsx'));
const ProjectCaseStudy = lazy(() => import('./components/ProjectCaseStudy.jsx'));

function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="site-frame site-topbar">
    <a href="/#home" className="site-brand" onClick={() => setOpen(false)}><span className="brand-symbol">PJ</span><span>Parag Jindal</span></a>
    <button type="button" className="site-menu" aria-label="Toggle menu" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>Menu <span aria-hidden="true">{open ? '−' : '+'}</span></button>
    <nav id="site-navigation" aria-label="Portfolio" data-open={open}>{NAVIGATION.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
    <a className="site-button site-button-outline" href="/lab">Engineering Lab <LabIcon name="arrow" size={15} /></a>
  </div></header>;
}

function RackIllustration() {
  return <figure className="hero-visual" aria-label="Conceptual rack hardware illustration">
    <div className="hero-visual-top"><span><span className="status-dot" /> ALDER RESEARCH FACILITY</span><span>SIMULATION</span></div>
    <div className="hero-racks" aria-hidden="true">
      {[0, 1, 2].map((rack) => <div className="hero-rack" key={rack}><div className="hero-rack-top" /><div className="hero-rack-side" /><div className="hero-rack-front"><span className="rack-face-label">LAB-R0{rack + 1}</span>{Array.from({ length: 7 }, (_, index) => <div className="hero-rack-unit" key={index}><i /><i /><i /><small /><b /></div>)}</div></div>)}
    </div>
    <figcaption><span>Conceptual rack illustration</span><span>Infrastructure engineering lab</span></figcaption>
  </figure>;
}

function SectionTitle({ label, children, description }) {
  return <div className="site-section-heading"><span className="eyebrow">{label}</span><h2>{children}</h2>{description && <p>{description}</p>}</div>;
}

function ProjectCard({ project }) {
  return <article className="site-project-card">
    <a className="site-project-preview" href={project.links.demo} aria-label={`Open ${project.name}`}><img src={project.screenshot.path} alt={project.screenshot.alt} loading="lazy" width={project.screenshot.width} height={project.screenshot.height} /></a>
    <div className="site-project-content"><div className="site-project-kind"><span className="eyebrow">{project.area}</span><span className="project-state">{project.status}</span></div><h3>{project.name}</h3><p>{project.description}</p><p className="site-project-stack">{project.stack}</p><div className="site-project-links"><a href={project.links.demo}>Open demo <LabIcon name="arrow" size={15} /></a><a href={project.links.source}>Source</a><a href={project.links.caseStudy}>Case study</a></div></div>
  </article>;
}

function Greeting() {
  const position = useMotionValue(0);
  return <div className="engineering-site"><header className="site-header"><div className="site-frame site-topbar"><a className="site-brand" href="/"><span className="brand-symbol">PJ</span> Parag Jindal</a><a href="/">Back to portfolio</a></div></header><main className="site-frame site-greeting"><h1>Interactive 3D greeting</h1><div className="site-spline"><Suspense fallback={<p role="status">Loading 3D greeting…</p>}><SplineHero smoothProgress={position} /></Suspense></div></main></div>;
}

function Portfolio() {
  return <div className="engineering-site">
    <a className="skip-link" href="#home">Skip to content</a>
    <SiteHeader />
    <main id="home" tabIndex={-1}>
      <section className="site-frame site-hero" aria-labelledby="hero-title">
        <div><p className="eyebrow"><span className="status-dot" /> {CONTACT.city}, {CONTACT.province} · {CONTACT.country}</p><h1 id="hero-title">{CONTACT.name}</h1><p className="site-hero-title">{CURRENT_ROLE.title}</p><p className="site-intro">{POSITIONING}</p><div className="site-hero-actions"><a className="site-button site-button-primary" href="/lab">Open the lab <LabIcon name="arrow" size={17} /></a><a className="site-button site-button-outline" href="#projects">View My Work</a></div><a className="site-quiet-link" href="/greeting">Open 3D greeting <LabIcon name="external" size={14} /></a></div>
        <RackIllustration />
      </section>
      <section className="site-section site-section-tint" id="relayops">
        <div className="site-frame relay-feature">
          <div>
            <SectionTitle label="Flagship AI engineering project" description={RELAYOPS.description}>{RELAYOPS.name}</SectionTitle>
            <p className="relay-feature-detail">{RELAYOPS.detail}</p>
            <div className="site-hero-actions"><a className="site-button site-button-primary" href={RELAYOPS.links.demo}>Open offline demo <LabIcon name="arrow" size={17} /></a><a className="site-button site-button-outline" href={RELAYOPS.links.caseStudy}>View technical case study <LabIcon name="external" size={15} /></a></div>
          </div>
          <a className="relay-feature-preview" href={RELAYOPS.links.demo} aria-label="Open RelayOps AI"><img src={relayStudioScreenshot} width={RELAYOPS.screenshot.width} height={RELAYOPS.screenshot.height} loading="lazy" alt={RELAYOPS.screenshot.alt} /></a>
        </div>
      </section>
      <section className="site-section site-section-tint" id="projects"><div className="site-frame">
        <div className="site-section-row"><SectionTitle label="Featured work" description="Eight working applications for a fictional data centre, plus standalone tools for storage planning, network design, and local AI.">Infrastructure engineering lab</SectionTitle><a className="site-button site-button-outline" href="/lab">All applications <LabIcon name="arrow" size={15} /></a></div>
        <div className="site-project-grid">{FEATURED_LAB_IDS.map((id) => <ProjectCard key={id} project={LAB_PROJECTS.find((project) => project.id === id)} />)}</div>
      </div></section>
      <section className="site-section" id="about"><div className="site-frame site-about-grid">
        <SectionTitle label="About me">Software and infrastructure, from design to operations</SectionTitle><div className="site-about-copy"><p>I build AI products and workflow automation as an {CURRENT_ROLE.title} in {CONTACT.city}. I completed a {EDUCATION.degree} at {EDUCATION.institution} in {employmentMonth(EDUCATION.completed)}, with a {EDUCATION.specialization} specialization.</p><p>My independent lab uses fictional assets and repeatable scenarios to explore observability, operational incident response, safe automation, and design trade-offs.</p><a className="site-quiet-link" href={CONTACT.linkedin}>Connect on LinkedIn <LabIcon name="external" size={15} /></a></div>
      </div></section>
      <section className="site-section site-section-tint" id="services"><div className="site-frame"><SectionTitle label="Capabilities">Engineering expertise</SectionTitle><div className="site-expertise">{EXPERTISE.map(([icon, title, description]) => <article key={title}><span className="lab-icon"><LabIcon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}</div><div className="site-ai-callout"><div><h3>AI and infrastructure automation</h3><p>Trace a simulated incident through validated tools in InfraPilot AI, or inspect the source passages behind an answer in LocalMind.</p></div><div><a href="/lab/infrapilot-ai?scenario=critical">InfraPilot AI <LabIcon name="arrow" size={15} /></a><a href="/lab/localmind">LocalMind <LabIcon name="arrow" size={15} /></a></div></div></div></section>
      <section className="site-section" id="software"><div className="site-frame"><SectionTitle label="Selected work">Software projects</SectionTitle><div className="site-software-grid">{SELECTED_SOFTWARE.map((project) => <article key={project.title}><h3>{project.title}</h3><p>{project.description}</p><p className="site-project-stack">{project.tech}</p>{project.url && <a href={project.url}>{project.link} <LabIcon name="external" size={14} /></a>}</article>)}</div></div></section>
      <ProfessionalExperience />
      <section className="site-section" id="stack"><div className="site-frame site-about-grid"><SectionTitle label="Tools">Technology stack</SectionTitle><div className="site-technology-groups">{TECHNOLOGIES.map(([area, tools]) => <div key={area}><h3>{area}</h3><ul className="site-stack">{tools.map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div></div></section>
      <section className="site-section site-section-tint" id="github"><div className="site-frame site-section-row"><SectionTitle label="Open development" description="Browse source code, contribution history, and updates to the engineering lab.">GitHub activity</SectionTitle><a href={`${GITHUB}?tab=overview`} className="site-button site-button-outline">View contributions <LabIcon name="external" size={15} /></a></div></section>
      <ContactSection />
    </main>
    <footer className="site-footer"><div className="site-frame"><span>Parag Jindal · Ottawa, Canada</span><div><a href={GITHUB}>GitHub</a><a href={CONTACT.linkedin}>LinkedIn</a><a href="/#home">Back to top ↑</a></div></div></footer>
  </div>;
}

export default function App() {
  const { page, slug } = resolvePortfolioRoute(window.location.pathname);
  if (page === 'lab') return <Suspense fallback={<p role="status">Loading engineering lab…</p>}><LabShell slug={slug} /></Suspense>;
  if (page === 'greeting') return <Greeting />;
  if (page === 'case-study') return <Suspense fallback={<p role="status">Loading case study…</p>}><ProjectCaseStudy slug={slug} /></Suspense>;
  return <Portfolio />;
}
