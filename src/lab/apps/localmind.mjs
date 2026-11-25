export const DOCUMENT_LIMIT = 32;
export const DOCUMENT_CHAR_LIMIT = 100_000;

const STOP = new Set('a an and are as at be but by can do does for from how i if in is it its me of on or should than that the their then there these they this to was were what when where which who will with would you your'.split(' '));
const MAX_CHUNKS = 4_000;
const SENTENCES = new Intl.Segmenter('en', { granularity: 'sentence' });
const ALIASES = {
  alarm: 'alert', alarms: 'alert', alerts: 'alert', alarming: 'alert', warning: 'alert', warnings: 'alert',
  artifacts: 'artifact', backups: 'backup', breaker: 'circuit', breakers: 'circuit',
  capacity: 'capacity', sizing: 'capacity', cite: 'citation', citations: 'citation',
  computational: 'compute', computing: 'compute', cooling: 'thermal', cool: 'thermal',
  drift: 'change', changes: 'change', differences: 'change', draws: 'draw', drawing: 'draw',
  electrical: 'power', energy: 'power', watts: 'power', electricity: 'power',
  failover: 'recovery', failures: 'failure', failing: 'failure', failed: 'failure',
  graphics: 'gpu', gpus: 'gpu', accelerator: 'gpu', accelerators: 'gpu',
  heat: 'thermal', heated: 'thermal', overheating: 'thermal', overheats: 'thermal',
  hot: 'thermal', warmth: 'thermal', temperature: 'thermal', temperatures: 'thermal',
  hosts: 'host', humidity: 'moisture', humid: 'moisture', outlets: 'outlet',
  receptacles: 'outlet', sockets: 'outlet', pdus: 'pdu',
  rebuild: 'recovery', reconstruct: 'recovery', restore: 'recovery', restoration: 'recovery',
  remediation: 'resolve', replicates: 'replica', replicas: 'replica', replication: 'replica',
  nodes: 'node', racks: 'rack', reserved: 'reservation', reservations: 'reservation',
  snapshots: 'snapshot', segments: 'segment', segmentation: 'segment', servers: 'server',
  thresholds: 'threshold', utilization: 'usage', utilisation: 'usage', volumes: 'volume',
};

export const SAMPLE_DOCUMENTS = [
  {
    id: 'thermal', title: 'Alder Lab · Thermal incident runbook', text: [
      'The Alder Lab uses synthetic telemetry to rehearse thermal incident triage. A graphics accelerator temperature at or above 85 °C is a warning, and above 92 °C requires immediate investigation. Compare the GPU reading to the neighboring devices, rack inlet sensor, fan state, and recent workload changes before inferring a facility issue.',
      'If multiple accelerators and the aisle intake heat up together, inspect simulated cooling events and verify that rack doors and air paths are unobstructed. If only one accelerator is hot, confirm the workload and fan state, then open a ticket with the host name, GPU index, current reading, threshold, and recent peak.',
      'After the temperature stabilizes below the warning threshold for three samples, record the recovery time and continue monitoring. Any workload drain in the simulation needs operator approval.',
    ].join('\n\n'),
  },
  {
    id: 'power', title: 'Alder Lab · Power distribution notes', text: [
      'For a sustained PDU outlet load above 80% of its rated wattage, record the outlet, connected equipment, measured draw, rated capacity, and phase assignment. Compare the three phase loads and identify spare capacity on other phases before proposing a device move.',
      'Never reboot a simulated outlet before confirming the connected device mapping and redundancy. A power action requires approval by a switched-outlet operator, a second confirmation in PowerOps, and an audit entry containing the operation and timestamp.',
      'Use kilowatts for instantaneous power reports and kilowatt-hours for energy over a reporting interval. A 1.5 kW load over four hours uses 6 kWh. Report the interval and sample coverage alongside each estimate.',
    ].join('\n\n'),
  },
  {
    id: 'storage', title: 'Juniper Lab · Storage planning handbook', text: [
      'Replication factor three stores three copies of each object. Divide raw capacity by three to estimate theoretical usable capacity before operating headroom. Reserve free space for rebalancing and recovery before committing storage allocations.',
      'For erasure coding with k data chunks and m parity chunks, multiply raw capacity by k divided by k plus m for the theoretical usable capacity. A design that places one chunk in each host failure domain requires at least k plus m distinct hosts for initial placement.',
      'Node loss reduces the remaining raw capacity and may prevent placement even if aggregate capacity looks sufficient. Validate actual failure domains, stripe placement, headroom, and network behavior before relying on either a replicated or erasure coded layout.',
    ].join('\n\n'),
  },
  {
    id: 'inventory', title: 'Juniper Lab · Inventory synchronization', text: [
      'Capture a baseline inventory snapshot before synchronizing host, virtual machine, and container metadata. Use stable asset IDs, then compare normalized fields to separate additions, removals, and changed assets.',
      'An asset temporarily absent from an API response may be unreachable or filtered. Treat unexpected removals as unconfirmed until a second read verifies the change. Store the snapshot timestamp and source adapter with each export.',
      'Read-only discovery uses an inventory token scoped to permitted hosts. Keep credentials on the operator workstation, and use synthetic addresses and MACs in exported demos.',
    ].join('\n\n'),
  },
];

export const SAMPLE_QUESTIONS = [
  { query: 'What should I check when an accelerator overheats?', documentId: 'thermal' },
  { query: 'How do I handle a socket drawing too much electricity?', documentId: 'power' },
  { query: 'What is the theoretical usable capacity with erasure coding?', documentId: 'storage' },
  { query: 'How do I verify an asset disappeared after synchronization?', documentId: 'inventory' },
];

export function normalizeDocument(document) {
  if (!document || typeof document.id !== 'string' || !document.id || typeof document.title !== 'string' || typeof document.text !== 'string') {
    throw new Error('A document needs an ID, title, and text.');
  }
  const title = document.title.replace(/\s+/g, ' ').trim();
  const text = document.text.trim();
  if (!title || title.length > 120 || !text || text.length > DOCUMENT_CHAR_LIMIT) {
    throw new Error('Enter a title of 1–120 characters and text of 1–100,000 characters.');
  }
  return { id: document.id, title, text };
}

export function validateChunkSettings(size, overlap) {
  if (!Number.isInteger(size) || size < 30 || size > 300 || !Number.isInteger(overlap) || overlap < 0 || overlap >= size || overlap > 75) {
    throw new Error('Use 30–300 words per chunk and overlap of 0–75 words below the chunk size.');
  }
}

export function chunkDocument(document, size = 70, overlap = 12, remainingChunks = MAX_CHUNKS) {
  validateChunkSettings(size, overlap);
  const normalized = normalizeDocument(document);
  const words = normalized.text.split(/\s+/);
  const count = Math.max(1, 1 + Math.ceil((words.length - size) / (size - overlap)));
  if (count > remainingChunks) throw new Error('Increase chunk size or remove documents to stay within 4,000 chunks.');
  const chunks = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    const end = Math.min(start + size, words.length);
    chunks.push({
      id: normalized.id + ':' + (chunks.length + 1),
      documentId: normalized.id,
      title: normalized.title,
      number: chunks.length + 1,
      startWord: start + 1,
      endWord: end,
      text: words.slice(start, end).join(' '),
    });
    if (end === words.length) break;
  }
  return chunks;
}

function tokens(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 1 && !STOP.has(word))
    .map((word) => Object.hasOwn(ALIASES, word) ? ALIASES[word] : word);
}

const VECTOR_DIMENSIONS = 4096;

function hash(term) {
  let value = 2166136261;
  for (const character of term) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function embed(text, weights = new Map()) {
  const words = tokens(text);
  const terms = new Map();
  const increment = (term, amount) => terms.set(term, (terms.get(term) || 0) + amount);
  words.forEach((word, index) => {
    increment(word, 1);
    if (index > 0) increment(words[index - 1] + ' ' + word, 0.35);
  });
  const vector = new Map();
  for (const [term, count] of terms) {
    const key = hash(term);
    const bucket = key % VECTOR_DIMENSIONS;
    const signedWeight = key & 0x10000 ? 1 : -1;
    const value = Math.sqrt(count) * (weights.get(term) || 1);
    vector.set(bucket, (vector.get(bucket) || 0) + signedWeight * value);
  }
  const norm = Math.hypot(...vector.values());
  if (!norm) return vector;
  for (const [key, value] of vector) vector.set(key, value / norm);
  return vector;
}

export function cosine(first, second) {
  let similarity = 0;
  for (const [key, value] of first) similarity += value * (second.get(key) || 0);
  return similarity;
}

export function buildIndex(documents, size = 70, overlap = 12) {
  validateChunkSettings(size, overlap);
  if (!Array.isArray(documents) || documents.length > DOCUMENT_LIMIT) throw new Error('The document limit is 32.');
  const seenIds = new Set();
  const chunks = [];
  for (const document of documents) {
    const normalized = normalizeDocument(document);
    if (seenIds.has(normalized.id)) throw new Error('Document IDs must be unique.');
    seenIds.add(normalized.id);
    chunks.push(...chunkDocument(normalized, size, overlap, MAX_CHUNKS - chunks.length));
  }
  const frequencies = new Map();
  for (const chunk of chunks) {
    for (const term of new Set(tokens(chunk.text + ' ' + chunk.title))) {
      frequencies.set(term, (frequencies.get(term) || 0) + 1);
    }
  }
  const weights = new Map([...frequencies].map(([term, count]) => [term, 1 + Math.log((chunks.length + 1) / (count + 1))]));
  return {
    weights,
    chunks: chunks.map((chunk) => ({
      ...chunk,
      vector: embed(chunk.title + ' ' + chunk.text, weights),
      terms: new Set(tokens(chunk.title + ' ' + chunk.text)),
    })),
  };
}

export function searchIndex(index, query, limit = 4) {
  if (typeof query !== 'string' || !query.trim() || !Number.isInteger(limit) || limit < 1 || limit > 20) return [];
  const normalized = tokens(query);
  const queryTerms = new Set(normalized);
  const vector = embed(query, index.weights);
  return index.chunks
    .map(({ vector: chunkVector, terms, ...chunk }) => ({
      ...chunk,
      score: cosine(vector, chunkVector),
      matched: [...queryTerms].filter((term) => terms.has(term)).length,
    }))
    .filter(({ score, matched }) => score >= 0.075 && matched > 0)
    .sort((first, second) => second.score - first.score || second.matched - first.matched || first.id.localeCompare(second.id))
    .slice(0, limit);
}

export function answerFromSources(query, results) {
  const terms = new Set(tokens(query));
  const seen = new Set();
  const passages = results.slice(0, 4).flatMap((result) => {
    return Array.from(SENTENCES.segment(result.text), ({ segment }) => {
      const text = segment.trim();
      const matching = [...new Set(tokens(text))].filter((term) => terms.has(term)).length;
      return { text, sourceId: result.id, score: matching + result.score, matching };
    });
  });
  return passages
    .filter(({ text, matching }) => matching > 0 && text.length >= 20)
    .sort((first, second) => second.score - first.score)
    .filter(({ text }) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    })
    .slice(0, 3)
    .map(({ text, sourceId }) => ({ text, sourceId }));
}

export function evaluateRetrieval(index, cases, limit = 3) {
  const results = cases.map(({ query, documentId }) => {
    const rank = searchIndex(index, query, limit).findIndex((result) => result.documentId === documentId) + 1;
    return { query, documentId, rank };
  });
  return {
    results,
    recall: results.length ? results.filter(({ rank }) => rank > 0).length / results.length : 0,
    meanReciprocalRank: results.length ? results.reduce((sum, { rank }) => sum + (rank ? 1 / rank : 0), 0) / results.length : 0,
  };
}

export function compareRetrievalSettings(documents, cases, baselineIndex, baselineSettings, candidateSettings) {
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > 100 || cases.some((entry) =>
    typeof entry?.query !== 'string' || !entry.query.trim() || entry.query.length > 500 || typeof entry.documentId !== 'string' || !entry.documentId)) {
    throw new Error('Provide 1–100 queries with expected document IDs.');
  }
  const candidateIndex = buildIndex(documents, candidateSettings.size, candidateSettings.overlap);
  const baseline = evaluateRetrieval(baselineIndex, cases);
  const candidate = evaluateRetrieval(candidateIndex, cases);
  const summary = ({ recall, meanReciprocalRank }, index, settings) => ({
    settings: { ...settings },
    chunkCount: index.chunks.length,
    recall,
    meanReciprocalRank,
  });
  return {
    schemaVersion: 1,
    mode: 'offline',
    documentCount: documents.length,
    cutoff: 3,
    baseline: summary(baseline, baselineIndex, baselineSettings),
    candidate: summary(candidate, candidateIndex, candidateSettings),
    cases: baseline.results.map(({ query, documentId, rank }, index) => {
      const candidateRank = candidate.results[index].rank;
      const baselinePosition = rank || Infinity;
      const candidatePosition = candidateRank || Infinity;
      return {
        query, documentId, baselineRank: rank, candidateRank,
        outcome: candidatePosition === baselinePosition ? 'unchanged' : candidatePosition < baselinePosition ? 'improved' : 'regressed',
      };
    }),
  };
}
