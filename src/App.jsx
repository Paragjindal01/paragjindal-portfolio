import { lazy, Suspense, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import ContactSection from './components/ContactSection.jsx';
import { GITHUB, LAB_PROJECTS, REPOSITORY } from './lab/catalog.mjs';
import LabIcon from './lab/LabIcon.jsx';
import relayStudioScreenshot from '../relayops-ai/docs/screenshots/studio.webp';
import './engineering.css';

const LabShell = lazy(() => import('./lab/LabShell.jsx'));
const SplineHero = lazy(() => import('./components/SplineHero.jsx'));
const LINKEDIN = 'https://www.linkedin.com/in/parag-jindal-604b41320/';
const sections = [
  ['#about', 'About'], ['#services', 'Expertise'], ['#projects', 'Projects'], ['#experience', 'Experience'], ['#contact', 'Contact'],
];
const expertise = [
  ['spark', 'AI engineering', 'Local inference, retrieval-augmented generation, structured tools, and workflow automation.'],
  ['rack', 'GPU and data centre infrastructure', 'GPU systems, rack visualization, environmental monitoring, PDU telemetry, and asset inventory.'],
  ['network', 'Networks and distributed systems', 'Ethernet and InfiniBand fabrics, VLAN segmentation, virtualization, and capacity planning.'],
  ['server', 'Full-stack engineering', 'Accessible interfaces, typed APIs, relational data, reproducible deployments, and automated testing.'],
];
const previous = [
  { title: 'SafeKelowna', description: 'Community safety platform with map-based reporting, lost-and-found listings, private messaging, and moderation.', tech: 'Next.js · TypeScript · PostgreSQL · Leaflet', url: 'https://safekelowna.com', link: 'Visit website' },
  { title: 'Algorithmic Trading Platform', description: 'Team capstone for preparing market data and serving XGBoost predictions through backend APIs.', tech: 'FastAPI · XGBoost · Docker · Slurm' },
  { title: 'Diagram Data Warehouse', description: 'Educational diagram uploads, metadata, advanced search, API access, and analysis exports.', tech: 'React · GraphQL · PostgreSQL · AWS S3' },
  { title: 'Financial Analytics iOS App', description: 'Mobile development project for financial analytics workflows.', tech: 'Swift · iOS', url: `${GITHUB}/financial-analytic-ios-app`, link: 'View source' },
  { title: 'Cybersecurity Home Lab', description: 'Personal learning and documentation for networking and security fundamentals.', tech: 'Networking · Security fundamentals', url: `${GITHUB}/cybersecurity-home-lab`, link: 'View repository' },
];
const experience = [
  ['Sep 2026 – Present', 'AI & Information Systems Specialist', 'AltaAI Inc. · Ottawa, Ontario', 'AI applications, workflow integrations, and infrastructure planning for GPU compute, networking, and storage.'],
  ['Apr 2026 – Sep 2026', 'Field Service Agent', 'Best Buy / Geek Squad · Kelowna, British Columbia', 'In-home and in-store technical support for computers, software, networking, and connected devices.'],
  ['Jan 2025 – Apr 2026', 'Student Employee', 'Okanagan College · Kelowna, British Columbia', 'Peer support, athletics and recreation programs, events, and campus services.'],
];
const featuredIds = ['infrapilot-ai', 'rackops', 'gpuwatch', 'powerops', 'fabriclab', 'virtscan', 'storagecalc', 'localmind'];

function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header"><div className="site-frame site-topbar">
    <a href="/#home" className="site-brand" onClick={() => setOpen(false)}><span className="brand-symbol">PJ</span><span>Parag Jindal</span></a>
    <button type="button" className="site-menu" aria-label="Toggle menu" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>Menu <span aria-hidden="true">{open ? '−' : '+'}</span></button>
    <nav id="site-navigation" aria-label="Portfolio" data-open={open}>{sections.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
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
    <a className="site-project-preview" href={`/lab/${project.id}`} aria-label={`Open ${project.name}`}><img src={`/lab-screenshots/${project.id}.webp`} alt={`${project.name} running in the engineering lab`} loading="lazy" width="1000" height="615" /></a>
    <div className="site-project-content"><div className="site-project-kind"><span className="eyebrow">{project.area}</span><span className="project-state">Interactive demo</span></div><h3>{project.name}</h3><p>{project.description}</p><p className="site-project-stack">{project.stack}</p><div className="site-project-links"><a href={`/lab/${project.id}`}>Open demo <LabIcon name="arrow" size={15} /></a><a href={`${REPOSITORY}/blob/main/src/lab/apps/${project.file}.jsx`}>Source</a><a href={`${REPOSITORY}/blob/main/docs/projects/${project.id}.md`}>Case study</a></div></div>
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
        <div><p className="eyebrow"><span className="status-dot" /> Ottawa, Ontario · Canada</p><h1 id="hero-title">Parag Jindal</h1><p className="site-hero-title">AI &amp; Information Systems Specialist</p><p className="site-intro">I build AI software and the infrastructure that runs it. My work spans GPU systems, data centre operations, and full-stack engineering.</p><div className="site-hero-actions"><a className="site-button site-button-primary" href="/lab">Open the lab <LabIcon name="arrow" size={17} /></a><a className="site-button site-button-outline" href="#projects">View My Work</a></div><a className="site-quiet-link" href="/greeting">Open 3D greeting <LabIcon name="external" size={14} /></a></div>
        <RackIllustration />
      </section>
      <section className="site-section site-section-tint" id="relayops">
        <div className="site-frame relay-feature">
          <div>
            <SectionTitle label="Flagship AI engineering project" description="Build an executable graph, run it against sample data, inspect every step, and decide whether a simulated action should proceed.">RelayOps AI</SectionTitle>
            <p className="relay-feature-detail">The visual studio shares a validated workflow contract with a local SQLite execution service that retains approvals, retries, and trace events across restarts.</p>
            <div className="site-hero-actions"><a className="site-button site-button-primary" href="/relayops/">Open offline demo <LabIcon name="arrow" size={17} /></a><a className="site-button site-button-outline" href={`${REPOSITORY}/tree/main/relayops-ai`}>View source and case study <LabIcon name="external" size={15} /></a></div>
          </div>
          <a className="relay-feature-preview" href="/relayops/" aria-label="Open RelayOps AI"><img src={relayStudioScreenshot} width="1099" height="690" loading="lazy" alt="RelayOps AI studio with the Infrastructure Incident Investigator graph" /></a>
        </div>
      </section>
      <section className="site-section site-section-tint" id="projects"><div className="site-frame">
        <div className="site-section-row"><SectionTitle label="Featured work" description="Eight working applications for a fictional data centre, plus standalone tools for storage planning, network design, and local AI.">Infrastructure engineering lab</SectionTitle><a className="site-button site-button-outline" href="/lab">All applications <LabIcon name="arrow" size={15} /></a></div>
        <div className="site-project-grid">{featuredIds.map((id) => <ProjectCard key={id} project={LAB_PROJECTS.find((project) => project.id === id)} />)}</div>
      </div></section>
      <section className="site-section" id="about"><div className="site-frame site-about-grid">
        <SectionTitle label="About me">Software and infrastructure, from design to operations</SectionTitle><div className="site-about-copy"><p>I’m a Bachelor of Computer Information Systems graduate from Okanagan College, based in Ottawa. As an AI &amp; Information Systems Specialist, I work across the application layer and the systems that keep it running.</p><p>My independent lab uses fictional assets and repeatable scenarios to explore observability, operational incident response, safe automation, and design trade-offs.</p><a className="site-quiet-link" href={LINKEDIN}>Connect on LinkedIn <LabIcon name="external" size={15} /></a></div>
      </div></section>
      <section className="site-section site-section-tint" id="services"><div className="site-frame"><SectionTitle label="Capabilities">Engineering expertise</SectionTitle><div className="site-expertise">{expertise.map(([icon, title, description]) => <article key={title}><span className="lab-icon"><LabIcon name={icon} /></span><h3>{title}</h3><p>{description}</p></article>)}</div><div className="site-ai-callout"><div><h3>AI and infrastructure automation</h3><p>Trace a simulated incident through validated tools in InfraPilot AI, or inspect the source passages behind an answer in LocalMind.</p></div><div><a href="/lab/infrapilot-ai?scenario=critical">InfraPilot AI <LabIcon name="arrow" size={15} /></a><a href="/lab/localmind">LocalMind <LabIcon name="arrow" size={15} /></a></div></div></div></section>
      <section className="site-section" id="software"><div className="site-frame"><SectionTitle label="Selected work">Software projects</SectionTitle><div className="site-software-grid">{previous.map((project) => <article key={project.title}><h3>{project.title}</h3><p>{project.description}</p><p className="site-project-stack">{project.tech}</p>{project.url && <a href={project.url}>{project.link} <LabIcon name="external" size={14} /></a>}</article>)}</div></div></section>
      <section className="site-section site-section-tint" id="experience"><div className="site-frame site-about-grid"><SectionTitle label="Work history">Professional experience</SectionTitle><div className="site-experience">{experience.map(([period, role, company, summary]) => <article key={role}><span className="eyebrow">{period}</span><h3>{role}</h3><strong>{company}</strong><p>{summary}</p></article>)}</div></div></section>
      <section className="site-section" id="stack"><div className="site-frame site-about-grid"><SectionTitle label="Tools">Technology stack</SectionTitle><ul className="site-stack">{['React', 'TypeScript', 'Python', 'FastAPI', 'Linux', 'Docker', 'Proxmox', 'PostgreSQL', 'Ollama', 'Ceph', 'Ethernet', 'InfiniBand', 'GitHub Actions', 'Vercel'].map((item) => <li key={item}>{item}</li>)}</ul></div></section>
      <section className="site-section site-section-tint" id="github"><div className="site-frame site-section-row"><SectionTitle label="Open development" description="Browse source code, contribution history, and updates to the engineering lab.">GitHub activity</SectionTitle><a href={`${GITHUB}?tab=overview`} className="site-button site-button-outline">View contributions <LabIcon name="external" size={15} /></a></div></section>
      <ContactSection />
    </main>
    <footer className="site-footer"><div className="site-frame"><span>Parag Jindal · Ottawa, Canada</span><div><a href={GITHUB}>GitHub</a><a href={LINKEDIN}>LinkedIn</a><a href="/#home">Back to top ↑</a></div></div></footer>
  </div>;
}

export default function App() {
  const [, segment, slug] = window.location.pathname.split('/');
  if (segment === 'lab') return <Suspense fallback={<p role="status">Loading engineering lab…</p>}><LabShell slug={slug} /></Suspense>;
  if (segment === 'greeting') return <Greeting />;
  return <Portfolio />;
}
