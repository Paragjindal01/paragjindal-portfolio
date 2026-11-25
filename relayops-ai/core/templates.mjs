import { datasetInput, incidentInput, repositoryInput, researchQuestion } from './fixtures.mjs';

const node = (id, type, label, operation, x, y = 140, extra = {}) => ({
  id, type, label, x, y, config: { operation, ...extra },
});
const link = (source, target, when) => when === undefined ? { source, target } : { source, target, when };
const trigger = (label = 'Receive input') => node('receive', 'trigger', label, 'manual', 30);
const report = (op, x, title, source) => node('report', 'document', 'Generate report', op, x, 140, { title, source });

export const templates = [
  {
    id: 'github-review', name: 'GitHub Engineering Review',
    description: 'Read public repository evidence and produce a prioritized, source-linked engineering review.',
    inputs: repositoryInput, outputs: ['report'],
    nodes: [
      trigger('Receive repository URL'),
      node('collect', 'api', 'Collect repository evidence', 'github-repository', 260),
      node('review', 'agent', 'Review engineering evidence', 'review-repo', 490, 140, { role: 'engineering-review', source: 'collect' }),
      node('verify', 'validate', 'Check citations and findings', 'required-fields', 720, 140, { source: 'review', required: ['findings', 'sources'] }),
      report('engineering-report', 950, 'Repository engineering review', 'review'),
    ],
    edges: [link('receive', 'collect'), link('collect', 'review'), link('review', 'verify'), link('verify', 'report')],
  },
  {
    id: 'research-pipeline', name: 'Autonomous Research Pipeline',
    description: 'Break down a question and synthesize a cited brief from a labeled sample-source collection.',
    inputs: { question: researchQuestion }, outputs: ['report'],
    nodes: [
      trigger('Receive research question'),
      node('plan', 'agent', 'Plan research', 'plan-research', 260, 80, { role: 'planning' }),
      node('sources', 'api', 'Load sample sources', 'research-sources', 260, 210),
      node('extract', 'agent', 'Extract relevant evidence', 'extract-evidence', 490, 140, { role: 'research' }),
      node('verify', 'agent', 'Verify grounded claims', 'verify-research', 720, 140, { role: 'verification', source: 'extract' }),
      report('research-report', 950, 'Research brief', 'verify'),
    ],
    edges: [link('receive', 'plan'), link('receive', 'sources'), link('plan', 'extract'), link('sources', 'extract'), link('extract', 'verify'), link('verify', 'report')],
  },
  {
    id: 'data-analyst', name: 'Data Intelligence Analyst',
    description: 'Validate CSV or JSON, calculate statistics and outliers, and export a data report with chart series.',
    inputs: datasetInput, outputs: ['report'],
    nodes: [
      trigger('Receive CSV or JSON'),
      node('parse', 'transform', 'Parse structured dataset', 'parse-dataset', 260),
      node('verify', 'validate', 'Validate tabular structure', 'dataset', 490, 140, { source: 'parse' }),
      node('analysis', 'agent', 'Calculate statistics and anomalies', 'analyze-data', 720, 140, { role: 'data-analysis', source: 'verify' }),
      report('analysis-report', 950, 'Data intelligence report', 'analysis'),
    ],
    edges: [link('receive', 'parse'), link('parse', 'verify'), link('verify', 'analysis'), link('analysis', 'report')],
  },
  {
    id: 'incident-investigator', name: 'Infrastructure Incident Investigator',
    description: 'Correlate synthetic infrastructure telemetry and require review for a simulated mitigation.',
    inputs: incidentInput, outputs: ['report', 'mitigation', 'summary'],
    nodes: [
      trigger('Receive synthetic telemetry'),
      node('normalize', 'transform', 'Normalize telemetry', 'normalize-telemetry', 260),
      node('correlate', 'agent', 'Correlate incident signals', 'correlate-incident', 490, 140, { role: 'data-analysis', source: 'normalize' }),
      report('incident-report', 720, 'Synthetic incident report', 'correlate'),
      node('gate', 'condition', 'Check critical severity', 'severity', 950, 140, { source: 'correlate' }),
      node('approval', 'approval', 'Approve simulated load reduction', 'simulated-mitigation', 1180, 55),
      node('mitigation', 'transform', 'Record approved simulation', 'simulate-mitigation', 1410, 55, { source: 'approval' }),
      node('summary', 'notification', 'Record review summary', 'simulated-notification', 1180, 240, { title: 'Review findings recorded' }),
    ],
    edges: [link('receive', 'normalize'), link('normalize', 'correlate'), link('correlate', 'report'), link('report', 'gate'),
      link('gate', 'approval', true), link('approval', 'mitigation'), link('gate', 'summary', false)],
  },
];
