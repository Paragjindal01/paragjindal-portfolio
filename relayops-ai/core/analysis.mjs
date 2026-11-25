import { isRecord } from './contracts.mjs';
import { researchSources } from './fixtures.mjs';

const STOP = new Set(['about', 'best', 'can', 'could', 'does', 'how', 'into', 'make', 'should', 'the', 'them', 'there', 'these', 'this', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'would', 'use', 'using', 'and', 'team', 'teams']);
const normalizeWords = (text) => [...new Set(text.toLowerCase().match(/[a-z0-9-]{3,}/g) || [])].filter((term) => !STOP.has(term));

export function planResearch(input) {
  const question = typeof input.question === 'string' ? input.question.trim() : '';
  if (typeof input.question !== 'string' || !question || question.length > 500) throw new Error('Enter a research question of at most 500 characters.');
  const terms = normalizeWords(question).slice(0, 20);
  return {
    question, terms,
    summary: 'Use the bundled reference passages to identify applicable concepts, then verify every claim against its source.',
    subtasks: ['Rank the sample passages against the question.', 'Record relevant source passages and their citation IDs.', 'Verify each claim is supported by its cited passage.'],
  };
}

export function selectEvidence(plan, sourceBundle) {
  if (!plan?.question || !Array.isArray(plan?.terms) || !Array.isArray(sourceBundle?.sources)) throw new Error('A research plan and source bundle are required.');
  const ranked = sourceBundle.sources.map((source) => {
    const indexed = new Set(normalizeWords(source.keywords));
    return { source, score: plan.terms.filter((term) => indexed.has(term)).length };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));
  return {
    mode: 'sample-sources', question: plan.question,
    claims: ranked.slice(0, 3).map(({ source, score }) => ({ sourceId: source.id, statement: source.passage, score })),
  };
}

export function verifyResearch(extracted) {
  if (extracted?.mode !== 'sample-sources' || !Array.isArray(extracted.claims) || !extracted.question) throw new Error('Sample-source claims are required for verification.');
  const approved = new Map(researchSources.map((source) => [source.id, source]));
  const claims = extracted.claims.filter(({ sourceId, statement }) => approved.get(sourceId)?.passage === statement);
  return {
    mode: 'sample-sources',
    question: extracted.question,
    summary: claims.length
      ? `Verified ${claims.length} relevant statements against the bundled reference passages.`
      : 'The bundled passages do not provide enough evidence to answer this question.',
    claims,
    verified: claims.length === extracted.claims.length && claims.length > 0,
    sources: [...new Set(claims.map((claim) => claim.sourceId))].map((id) => {
      const { title, url } = approved.get(id);
      return { id, title, url };
    }),
  };
}

function sourceFinding(source, priority, message) {
  return { priority, message, sourceIds: [source.id] };
}

export function engineeringReview(repository) {
  if (!repository?.fullName || !Array.isArray(repository.files) || !Array.isArray(repository.evidence)) throw new Error('Repository evidence is required.');
  const findings = [];
  const sources = repository.evidence.map(({ id, title, path, url }) => ({ id, title, path, ...(url ? { url } : {}) }));
  const treeSource = { id: 'repo-tree', title: 'Inspected root tree', ...(repository.url ? { url: repository.url } : {}) };
  sources.push(treeSource);
  const readme = repository.evidence.find(({ path }) => /^readme/i.test(path));
  if (!readme) findings.push(sourceFinding(treeSource, 'high', 'No eligible README was captured in this bounded sample. Confirm repository documentation and provide a contributor quickstart.'));
  if (readme && !/\b(test|tests|testing)\b/i.test(readme.text)) findings.push(sourceFinding(readme, 'medium', 'The captured README does not describe how to run tests. Add a command and its prerequisites.'));
  if (!repository.files.some((name) => /^\.?tests?$/i.test(name))) findings.push(sourceFinding(treeSource, 'review', 'No root-level test directory appears in the reviewed tree. Check for colocated tests before deciding whether to add coverage.'));
  const manifest = repository.evidence.find(({ path }) => path === 'package.json');
  if (manifest) {
    let manifestData;
    try { manifestData = JSON.parse(manifest.text); } catch { manifestData = null; }
    if (manifestData && !manifestData.scripts?.test) findings.push(sourceFinding(manifest, 'high', 'The captured package manifest has no test script. Publish a standard test entry point.'));
    if (manifestData && !manifestData.engines?.node) findings.push(sourceFinding(manifest, 'low', 'The package manifest does not declare a Node version. Document the runtime supported by the project.'));
  }
  const sample = repository.evidence.find(({ path }) => /\.(m?js|ts|py)$/.test(path));
  if (sample) {
    const match = sample.text.split(/\r?\n/).findIndex((line) => /\b(createServer|FastAPI|express)\s*\(/.test(line));
    if (match >= 0) findings.push({ ...sourceFinding(sample, 'review', 'The captured entry point initializes an HTTP service. Verify integration coverage for the startup path and documented response contracts.'), line: match + 1 });
  }
  if (!findings.length) findings.push(sourceFinding(treeSource, 'review', 'The sampled repository structure did not trigger these documentation and build checks. Extend the review with relevant files and execution evidence.'));
  findings.sort((a, b) => ['high', 'medium', 'low', 'review'].indexOf(a.priority) - ['high', 'medium', 'low', 'review'].indexOf(b.priority));
  return {
    mode: repository.mode,
    repository: repository.fullName,
    summary: `Reviewed ${repository.evidence.length} bounded text samples from ${repository.fullName}.`,
    revision: repository.revision || 'fictional fixture',
    findings, sources,
    limitations: 'A limited read-only review of the root tree and selected text files. Review suggestions are not findings about uninspected code.',
  };
}

export function inspectDocument(input) {
  const text = typeof input.document === 'string' ? input.document.trim() : '';
  const title = input.documentTitle ?? 'Input document';
  if (!text || text.length > 40_000 || text.includes('\u0000') || typeof title !== 'string' ||
    !title.trim() || title.length > 100 || /[\r\n]/.test(title)) {
    throw new Error('Provide TXT or Markdown content of at most 40,000 characters and a short document title.');
  }
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
  const lines = text.split(/\r?\n/);
  return {
    title,
    summary: `Processed ${lines.length} lines and ${words.length} words from the supplied document text.`,
    wordCount: words.length,
    lineCount: lines.length,
    headings: lines.flatMap((line, index) => {
      const match = /^(#{1,6})\s+(.+)$/.exec(line);
      return match ? [{ line: index + 1, depth: match[1].length, text: match[2].slice(0, 150) }] : [];
    }).slice(0, 40),
    excerpts: text.split(/\r?\n(?:[ \t]*\r?\n)+/).slice(0, 5).map((paragraph) => paragraph.slice(0, 400)),
  };
}

const telemetryBounds = { serverCpuPct: [0, 100], gpuC: [-20, 130], powerPct: [0, 150], networkPct: [0, 100] };
const eventThresholds = {
  serverCpuPct: { key: 'CPU utilization', warn: 85, crit: 95, unit: '%' },
  gpuC: { key: 'GPU temperature', warn: 80, crit: 90, unit: '°C' },
  powerPct: { key: 'Power utilization', warn: 85, crit: 95, unit: '%' },
  networkPct: { key: 'Network utilization', warn: 85, crit: 95, unit: '%' },
};

export function normalizeTelemetry(input) {
  if (input.synthetic !== true || typeof input.incidentId !== 'string' || !/^(LAB|SIM)-[A-Za-z0-9-]{1,36}$/.test(input.incidentId) ||
      !Array.isArray(input.telemetry) || !input.telemetry.length || input.telemetry.length > 200) {
    throw new Error('Use 1–200 explicitly synthetic samples and a LAB- or SIM-prefixed incident ID.');
  }
  const ids = new Set();
  const telemetry = input.telemetry.map((row) => {
    if (!isRecord(row) || !Number.isInteger(row.minute) || row.minute < 0 || row.minute > 1440 ||
        typeof row.asset !== 'string' || !/^(LAB|SIM)-[A-Za-z0-9-]{1,36}$/.test(row.asset)) {
      throw new Error('Every telemetry sample needs a synthetic asset ID and an integer minute from 0 to 1,440.');
    }
    const id = row.minute + ':' + row.asset;
    if (ids.has(id)) throw new Error('Duplicate asset and minute in telemetry.');
    ids.add(id);
    const sample = { asset: row.asset, minute: row.minute };
    for (const [metric, [min, max]] of Object.entries(telemetryBounds)) {
      const value = row[metric];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid value for "${metric}".`);
      sample[metric] = value;
    }
    return sample;
  }).sort((a, b) => a.minute - b.minute || a.asset.localeCompare(b.asset));
  return { incidentId: input.incidentId, mode: 'synthetic', telemetry };
}

export function correlateIncident(normalized) {
  if (normalized?.mode !== 'synthetic' || !Array.isArray(normalized.telemetry)) throw new Error('Normalized synthetic telemetry is required.');
  const events = normalized.telemetry.flatMap((sample) => Object.entries(eventThresholds).flatMap(([metric, threshold]) => {
    if (sample[metric] < threshold.warn) return [];
    return [{
      asset: sample.asset, minute: sample.minute, metric,
      name: threshold.key, unit: threshold.unit,
      severity: sample[metric] >= threshold.crit ? 'critical' : 'warning',
      value: sample[metric], threshold: sample[metric] >= threshold.crit ? threshold.crit : threshold.warn,
    }];
  }));
  const driver = events.find(({ severity, metric }) => severity === 'critical' && metric === 'gpuC') ||
    events.find(({ severity }) => severity === 'critical') || events[0] || null;
  const severity = driver?.severity ?? 'normal';
  const hypotheses = [];
  const thermal = events.filter(({ metric }) => metric === 'gpuC');
  const coupled = thermal.map((event) => ({
    thermal: event, power: events.find((candidate) => candidate.asset === event.asset &&
      candidate.metric === 'powerPct' && Math.abs(candidate.minute - event.minute) <= 5),
  })).find(({ power }) => power);
  if (coupled) hypotheses.push({
    statement: 'GPU heating and increased power demand coincide on the same asset. Increased workload or reduced cooling margin are plausible explanations.',
    evidence: [coupled.thermal, coupled.power],
  });
  const network = events.find(({ metric }) => metric === 'networkPct');
  if (network) hypotheses.push({ statement: 'High network utilization may indicate a concurrent workload or traffic burst. The measurements do not establish causality.', evidence: [network] });
  if (thermal.length && !coupled) hypotheses.push({ statement: 'A thermal excursion occurred without a nearby power alert. Review airflow or compare sensor readings before choosing a cause.', evidence: [thermal[0]] });
  const recommendation = severity === 'critical'
    ? 'Review cooling and scheduling on the affected synthetic asset, then approve a simulated load reduction if warranted.'
    : severity === 'warning' ? 'Continue monitoring and inspect the first warning interval before recommending mitigation.' : 'Continue baseline monitoring.';
  return {
    mode: 'synthetic', incidentId: normalized.incidentId, severity, recommendation, hypotheses,
    summary: `${normalized.telemetry.length} samples and ${events.length} threshold crossings. Severity: ${severity}.`,
    driver, events: events.slice(0, 100), eventCount: events.length,
    charts: Object.keys(eventThresholds).map((metric) => ({
      column: eventThresholds[metric].key,
      points: normalized.telemetry.slice(0, 48).map((sample) => ({ row: sample.minute, value: sample[metric], asset: sample.asset })),
    })),
  };
}

export function applySimulatedMitigation(approval, results) {
  if (approval?.decision !== 'approve') throw new Error('A completed human approval is required.');
  const investigation = Object.values(results).find((value) => value?.mode === 'synthetic' && value.severity === 'critical' && Array.isArray(value?.events));
  const event = investigation?.driver;
  if (event?.severity !== 'critical') throw new Error('A critical synthetic incident analysis is required.');
  return {
    mode: 'synthetic', event: 'simulated-load-limit-applied', incidentId: investigation.incidentId,
    asset: event.asset, projectedLoadLimitPct: 70,
    summary: `Recorded a simulated 70% load limit for ${event.asset}. No external action was executed.`,
  };
}
