import { isRecord } from './contracts.mjs';
import { researchSources, sampleRepository } from './fixtures.mjs';

const GITHUB_API = 'https://api.github.com';
const MAX_RESPONSE_BYTES = 512_000;
const MAX_TEXT_BYTES = 8_000;
const publicEarthquakeUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson';
const FILE_PART = /^[A-Za-z0-9_.-]{1,85}$/;
const manifestFiles = ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'Dockerfile'];
const codeFiles = ['src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js', 'src/main.jsx', 'src/main.tsx',
  'src/main.py', 'src/server.mjs', 'src/App.jsx', 'index.js', 'server.js', 'main.py'];

export async function boundedJson(fetcher, url, options = {}, limit = MAX_RESPONSE_BYTES) {
  const response = await fetcher(url, {
    ...options,
    redirect: 'error',
    credentials: 'omit',
  });
  if (!response.ok) {
    const error = new Error(`Service returned HTTP ${response.status}.`);
    error.status = response.status;
    const throttled = response.status === 429 || (response.status === 403 &&
      (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')));
    error.retryable = !throttled && response.status >= 500;
    if (throttled) error.code = 'connector_rate_limited';
    await response.body?.cancel().catch(() => {});
    throw error;
  }
  if (!response.body) throw new Error('Service returned an empty response.');
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body.cancel().catch(() => {});
    throw new Error('Service response exceeds the permitted size.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel('response too large').catch(() => {});
        throw new Error('Service response exceeds the permitted size.');
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Service returned invalid JSON.');
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export function parsePublicRepository(value) {
  if (typeof value !== 'string' || value.length > 192) throw new Error('Enter a public GitHub repository URL.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a public GitHub repository URL.'); }
  const match = /^\/([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)\/([a-z0-9_.-]{1,85})\/?$/i.exec(url.pathname);
  if (url.origin !== 'https://github.com' || url.username || url.password || url.search || url.hash || !match ||
      ['.', '..'].includes(match[2]) || /[\\\r\n]/.test(value)) throw new Error('Enter a public GitHub HTTPS repository URL without extra path segments.');
  const [owner, repository] = match.slice(1);
  const repo = repository.replace(/\.git$/i, '');
  if (repo === '' || repo === '.' || repo === '..') throw new Error('Repository name is invalid.');
  return { owner, repo, fullName: `${owner}/${repo}` };
}

function decodeEvidence(raw, id, path, repository, sha) {
  if (raw?.type !== 'file' || raw?.encoding !== 'base64' || typeof raw.content !== 'string' ||
    !Number.isFinite(raw.size) || raw.size > MAX_TEXT_BYTES || raw.content.length > MAX_TEXT_BYTES * 2) return null;
  const binary = atob(raw.content.replace(/\s+/g, ''));
  const text = new TextDecoder().decode(Uint8Array.from(binary, (letter) => letter.charCodeAt(0)));
  if (text.includes('\u0000') || !path.split('/').every((part) => FILE_PART.test(part) && !['.', '..'].includes(part))) return null;
  return {
    id, title: path, path, text,
    url: `https://github.com/${repository.fullName}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`,
  };
}

export async function publicRepositoryEvidence(value, { mode = 'offline', fetcher = fetch, signal } = {}) {
  const repository = parsePublicRepository(value);
  if (mode !== 'connected') {
    if (repository.fullName.toLowerCase() !== sampleRepository.fullName) throw new Error('Offline mode can review the bundled sample repository. Choose connected mode for another public repository.');
    return structuredClone(sampleRepository);
  }
  const base = `${GITHUB_API}/repos/${repository.fullName}`;
  const get = (path = '') => boundedJson(fetcher, base + path, {
    method: 'GET', signal,
    headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  const meta = await get();
  if (meta?.private !== false || typeof meta.default_branch !== 'string' || !meta.default_branch || meta.default_branch.length > 250) throw new Error('Repository is unavailable for public review.');
  const commit = await get('/commits/' + encodeURIComponent(meta.default_branch));
  if (typeof commit?.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(commit.sha)) throw new Error('Could not resolve a source revision.');
  const ref = '?ref=' + commit.sha;
  const contents = await get('/contents' + ref);
  if (!Array.isArray(contents) || contents.length > 1000) throw new Error('Repository contents are unavailable or exceed the review limit.');
  const files = contents.filter((entry) => typeof entry?.name === 'string' && FILE_PART.test(entry.name)).map((entry) => entry.name);
  const manifest = manifestFiles.find((candidate) =>
    contents.some((entry) => entry?.name === candidate && entry.type === 'file' && entry.size <= MAX_TEXT_BYTES));
  const actualSource = contents.some((row) => row?.type === 'dir' && row.name === 'src') ? 'src' : null;
  const sourceItems = actualSource ? await get('/contents/src' + ref) : contents;
  const sourceFile = codeFiles.find((candidate) => [...contents, ...(Array.isArray(sourceItems) && actualSource ? sourceItems : [])]
    .some((entry) => entry?.path === candidate && entry.type === 'file' && entry.size <= MAX_TEXT_BYTES));
  const targets = [
    ...contents.filter((item) => /^readme(\.[a-z]{1,10})?$/i.test(item?.name) && item.type === 'file' && item.size <= MAX_TEXT_BYTES).slice(0, 1).map((item) => item.name),
    ...(manifest ? [manifest] : []), ...(sourceFile ? [sourceFile] : []),
  ];
  const evidence = (await Promise.all(targets.map(async (path, index) => {
    const raw = await get('/contents/' + path.split('/').map(encodeURIComponent).join('/') + ref);
    return decodeEvidence(raw, 'repo-file-' + (index + 1), path, repository, commit.sha);
  }))).filter(Boolean);
  return {
    mode: 'connected', fullName: repository.fullName, language: typeof meta.language === 'string' ? meta.language.slice(0, 80) : null,
    description: typeof meta.description === 'string' ? meta.description.slice(0, 300) : '',
    files: files.slice(0, 80), rootEntryCount: files.length, evidence,
    revision: commit.sha, url: `https://github.com/${repository.fullName}/tree/${commit.sha}`,
  };
}

const earthquakeFixture = { mode: 'fixture', source: 'USGS schema example (fictional measurements)', entries: [{ id: 'sample-1', magnitude: 5.3, place: 'Fictional coast' }] };

async function publicEarthquakes({ mode, fetcher = fetch, signal }) {
  if (mode !== 'connected') return structuredClone(earthquakeFixture);
  const data = await boundedJson(fetcher, publicEarthquakeUrl, { method: 'GET', signal }, 256_000);
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Unexpected public feed format.');
  return {
    mode: 'connected', source: publicEarthquakeUrl,
    entries: data.features.slice(0, 25).filter((item) => isRecord(item?.properties)).map((item) => ({
      id: String(item.id || '').slice(0, 100),
      magnitude: Number.isFinite(item.properties.mag) ? item.properties.mag : null,
      place: typeof item.properties.place === 'string' ? item.properties.place.slice(0, 250) : '',
    })),
  };
}

export const connectors = Object.freeze({
  'github-repository': (input, context) => publicRepositoryEvidence(input.repositoryUrl, context),
  'research-sources': () => ({ mode: 'sample-sources', sources: structuredClone(researchSources) }),
  'public-earthquakes': (_input, context) => publicEarthquakes(context),
});
