import { BRAND_STATEMENT, CONTACT, CURRENT_ROLE, EDUCATION, EMPLOYMENT, POSITIONING, TECHNOLOGIES, employmentMonth, employmentPeriod, workplaceDetails } from '../src/data/professional.mjs';
import { FEATURED_LAB_IDS, findProject, GITHUB, RELAYOPS, REPOSITORY } from '../src/data/projects.mjs';

const live = (path) => CONTACT.website + path;
const flagships = [RELAYOPS, ...FEATURED_LAB_IDS.slice(0, 5).map(findProject)];
const supporting = FEATURED_LAB_IDS.slice(5).map(findProject);
const capabilities = {
  'relayops-ai': 'Versioned workflow graphs, durable SQLite execution, human approval, signed local webhooks, traces, and recorded evaluations.',
  'infrapilot-ai': 'Validated operational queries and report exports with captured telemetry, recommendations, approval decisions, and linked PowerOps actions.',
  rackops: '2D facility navigation, front and rear rack views, free rack units, and PDU-to-workload dependencies.',
  gpuwatch: 'Per-GPU metrics, historical threshold exposure within a replay window, utilization charts, and report exports.',
  powerops: 'PDU inventory, outlet mapping, modeled energy, phase balancing, and before/after audit exports.',
  localmind: 'Browser-local document retrieval, traceable citations, and side-by-side indexing evaluation.',
};
const joinLinks = (links) => links.map(([label, href]) => `[${label}](${href})`).join(' · ');

const sections = [
  '<!-- Generated from the portfolio professional data and project catalog. -->',
  `<img width="1200" src="./assets/engineering-profile.webp" alt="${CONTACT.name}, ${CURRENT_ROLE.title}. Conceptual engineering artwork." />`,
  `# ${CONTACT.name}\n\n**${CURRENT_ROLE.title}**\n\n${POSITIONING}\n\n${BRAND_STATEMENT}\n\n${CONTACT.city}, ${CONTACT.province}, ${CONTACT.country}\n\n${joinLinks([['Website', live('/')], ['Engineering lab', live('/lab')], ['LinkedIn', CONTACT.linkedin], ['Email', `mailto:${CONTACT.email}`]])}`,
  '## Flagship products\n\nIndependent software with runnable demos and published engineering evidence. The cover artwork is conceptual. Product screenshots show the actual applications.',
  ...flagships.map((project) => {
    const screenshot = project.screenshot.source ? `https://raw.githubusercontent.com/Paragjindal01/paragjindal-portfolio/main/${project.screenshot.source}` : live(project.screenshot.path);
    return `### ${project.name}\n\n${capabilities[project.id]}\n\n<img src="https://raw.githubusercontent.com/Paragjindal01/paragjindal-portfolio/main/docs/artwork/${project.id}.webp" width="340" alt="${project.name} conceptual cover artwork" /> <a href="${live(project.links.demo)}"><img src="${screenshot}" width="340" alt="${project.screenshot.alt}" /></a>\n\n${joinLinks([['Demo', live(project.links.demo)], ['Source', project.links.source], ['Technical case study', live(project.links.caseStudy)]])}`;
  }),
  '## Professional experience',
  ...EMPLOYMENT.map((employer) => `### ${employer.organization}\n\n${employer.roles.map((role) => {
    const heading = employer.roles.length > 1 ? `#### ${role.title}` : `**${role.title}**`;
    return `${heading}\n\n${employmentPeriod(role)} · ${workplaceDetails(role)}\n\n${role.summary}${role.highlights ? '\n\n' + role.highlights.map((detail) => `- ${detail}`).join('\n') : ''}`;
  }).join('\n\n')}`),
  `## Engineering laboratory\n\n${supporting.map((project) => `- **${project.name}** · ${project.description} ${joinLinks([['Demo', live(project.links.demo)], ['Case study', live(project.links.caseStudy)]])}`).join('\n')}\n\n${joinLinks([['Standalone source and installation', `${REPOSITORY}/tree/main/packages/standalone`], ['Simulation API', live('/api/simulation?scenario=critical')], ['InfraPilot incident replay', live('/lab/infrapilot-ai#incident-replay')]])}`,
  '```mermaid\nflowchart LR\n  Simulator[Versioned synthetic facility and telemetry] --> RackOps\n  Simulator --> GPUWatch\n  Simulator --> PowerOps\n  Simulator --> VirtScan\n  Simulator --> InfraPilot[InfraPilot AI]\n  InfraPilot -->|Reviewed handoff| PowerOps\n  InfraPilot --> Replay[Incident timeline and replay]\n  PowerOps --> Replay\n  Input[Independent planning and knowledge inputs] --> FabricLab\n  Input --> StorageCalc\n  Input --> LocalMind\n  RelayOps[RelayOps AI] --> Services[Browser demo or local SQLite worker]\n  Services --> Trace[Workflow traces and evaluation]\n```',
  `## Selected software\n\n- **[SafeKelowna](https://safekelowna.com/)** · Community safety map, reporting, messaging, and moderation.\n- **Algorithmic Trading Platform** · Team capstone for market data processing and XGBoost prediction serving.\n- **Diagram Data Warehouse** · Academic collaboration for diagram upload, search, and analysis.\n\nEarlier work includes the [Financial Analytics iOS App](${GITHUB}/financial-analytic-ios-app), [Cybersecurity Home Lab](${GITHUB}/cybersecurity-home-lab), and [Computer Networks coursework](${GITHUB}/COSC-417-Computer-Network).`,
  `## Technology\n\n${TECHNOLOGIES.map(([category, tools]) => `- **${category}** · ${tools.join(', ')}`).join('\n')}`,
  `## Education\n\n**${EDUCATION.degree}** · ${EDUCATION.institution}\n\n${EDUCATION.specialization} specialization · Completed ${employmentMonth(EDUCATION.completed)}`,
  `## Releases and verification\n\n[![Engineering lab CI](${REPOSITORY}/actions/workflows/verify.yml/badge.svg?branch=main)](${REPOSITORY}/actions/workflows/verify.yml) [![RelayOps AI CI](${REPOSITORY}/actions/workflows/relayops.yml/badge.svg?branch=main)](${REPOSITORY}/actions/workflows/relayops.yml)\n\n${joinLinks([['Engineering releases', REPOSITORY + '/releases'], ['RelayOps measured runs', RELAYOPS.links.benchmark], ['Actual GitHub contributions', `${GITHUB}?tab=overview#contribution-graph`]])}\n\nThe public infrastructure demos use fictional data and simulated controls. The work history describes business responsibilities at a public, technical level.`,
];

process.stdout.write(sections.join('\n\n') + '\n');
