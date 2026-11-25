import './masthead.css';
import artwork from './artwork.jpg';

const portfolio = 'https://paragjindal.com';
const tools = [
  ['RelayOps AI', 'RO', '/relayops/'],
  ['RackOps', 'RK', '/lab/rackops'],
  ['GPUWatch', 'GW', '/lab/gpuwatch'],
  ['PowerOps', 'PO', '/lab/powerops'],
  ['InfraPilot AI', 'IP', '/lab/infrapilot-ai'],
  ['FabricLab', 'FL', '/lab/fabriclab'],
  ['VirtScan', 'VS', '/lab/virtscan'],
  ['StorageCalc', 'SC', '/lab/storagecalc'],
  ['LocalMind', 'LM', '/lab/localmind'],
  ['ComputeFlow', 'CF', '/compute-flow/'],
];

export default function LabMasthead({ title, index, category, description, source, status }) {
  return <div className="hf-app-masthead">
    <header className="hf-app-nav">
      <a href={portfolio + '/'} className="hf-app-brand"><span aria-hidden="true">PJ</span>Parag Jindal</a>
      <nav aria-label="Portfolio sections">
        <a href={portfolio + '/lab'}>Lab</a>
        <a href={portfolio + '/#story'}>Story</a>
        <a href={portfolio + '/#work'}>Work</a>
        <a href={portfolio + '/#about'}>About</a>
      </nav>
      <a className="hf-app-contact" href={portfolio + '/#contact'}>Email Parag</a>
    </header>
    <section className="hf-app-hero" aria-label={title}>
      <div className="hf-app-art" aria-hidden="true"><img src={artwork} alt="" /></div>
      <div className="hf-app-hero-content">
        <p className="hf-app-crumb"><a href={portfolio + '/lab'}>Engineering Lab</a><span aria-hidden="true">/</span>{index} / {category}</p>
        <p className="hf-app-title">{title}</p>
        <p className="hf-app-description">{description}</p>
        <div className="hf-app-facts"><span>{status}</span><a href={source}>Source ↗</a><a href={portfolio + '/case-studies/' + source.split('/').at(-1)}>Case study ↗</a></div>
      </div>
    </section>
    <nav className="hf-app-switch" aria-label="Engineering applications">
      <a href={portfolio + '/lab'}>Overview</a>
      {tools.map(([name, code, path]) => <a key={path} href={portfolio + path} aria-current={name === title ? 'page' : undefined}>{code} · {name}</a>)}
    </nav>
  </div>;
}
