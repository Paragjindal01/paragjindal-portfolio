import { useEffect } from 'react';
import { CASE_STUDIES } from '../data/case-studies.mjs';
import { CONTACT } from '../data/professional.mjs';
import { ALL_PROJECTS, COMPUTE_FLOW, findProject, RELAYOPS } from '../data/projects.mjs';
import relayStudio from '../../relayops-ai/docs/screenshots/studio.webp';
import computeFlowWorkbench from '../../compute-flow/docs/workbench.webp';
import LabIcon from '../lab/LabIcon.jsx';

const standaloneScreenshots = { [RELAYOPS.id]: relayStudio, [COMPUTE_FLOW.id]: computeFlowWorkbench };

function CaseNavigation() {
  return <div className="site-header"><div className="site-frame site-topbar"><a className="site-brand" href="/"><span className="brand-symbol">PJ</span>Parag Jindal</a><a className="site-button site-button-outline" href="/lab">Engineering lab <LabIcon name="arrow" size={15} /></a></div></div>;
}

export default function ProjectCaseStudy({ slug }) {
  const project = findProject(slug);
  const study = CASE_STUDIES[slug];
  useEffect(() => {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `${CONTACT.website}${project?.links.caseStudy ?? '/case-studies'}`;
    document.title = `${project ? `${project.name} Case Study` : 'Engineering Case Studies'} | ${CONTACT.name}`;
  }, [project]);
  const picture = project?.screenshot.path ?? standaloneScreenshots[project?.id];

  return <div className="engineering-site"><CaseNavigation />
    <main className="site-frame case-study" id="main-content">
      <a className="site-quiet-link" href="/case-studies"><LabIcon name="back" size={16} /> Case studies</a>
      {!project || !study ? <><header><h1>Engineering case studies</h1><p>Architecture, implementation, and verified outcomes for the independent engineering portfolio.</p></header><ul className="case-study-index">{ALL_PROJECTS.map((item) => <li key={item.id}><a href={item.links.caseStudy}>{item.name} <LabIcon name="arrow" size={16} /></a><p>{item.description}</p></li>)}</ul></> : <>
        <header><p className="eyebrow">{project.area}</p><h1>{project.name}</h1><p>{project.description}</p><p className="site-project-stack">{project.stack}</p><div className="site-hero-actions"><a className="site-button site-button-primary" href={project.links.demo}>Open demo <LabIcon name="arrow" size={16} /></a><a className="site-button site-button-outline" href={project.links.source}>Source</a><a className="site-button site-button-outline" href={project.links.documentation}>Repository documentation</a></div></header>
        <figure><img src={picture} alt={project.screenshot.alt} width={project.screenshot.width} height={project.screenshot.height} /><figcaption>Screenshot of the running application</figcaption></figure>
        <div className="case-study-sections">
          <section><h2>Engineering problem</h2><p>{study.problem}</p><p>{study.objective}</p></section>
          <section><h2>Architecture and data flow</h2><ol className="case-study-flow">{study.flow.map((part) => <li key={part}>{part}</li>)}</ol><p>{study.decision}</p></section>
          <section><h2>Implementation challenge</h2><p>{study.challenge}</p></section>
          <section><h2>Security boundaries</h2><p>{study.security}</p></section>
          <section><h2>Verified workflows</h2><p>{project.verification}</p><a href={project.links.verification}>Test workflow and runs</a>{project.links.benchmark && <p><a href={project.links.benchmark}>Measured benchmarks</a></p>}</section>
          <section><h2>Try it</h2><p>{study.use}</p><h3>Remaining limitations</h3><p>{study.limits}</p></section>
        </div>
      </>}
    </main>
  </div>;
}
