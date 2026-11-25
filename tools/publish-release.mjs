import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const REPO = 'Paragjindal01/paragjindal-portfolio';
const API = 'https://api.github.com/repos/' + REPO;
const UPLOADS = 'https://uploads.github.com/repos/' + REPO;
const SHA = /^[a-f0-9]{40}$/;
const ASSET_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/;
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
const ATTEMPTS = 4;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = (directory, name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));

function readAsset(directory, name) {
  assert.match(name, ASSET_NAME);
  const bytes = readFileSync(join(directory, name));
  assert.ok(bytes.length > 0 && bytes.length <= 32 * 1024 * 1024, 'Invalid release asset size for ' + name);
  return {
    name, bytes, digest: hash(bytes),
    mediaType: name.endsWith('.tgz') ? 'application/gzip' : name.endsWith('.json') ? 'application/json' : 'text/plain',
    label: name,
  };
}

export function prepareRelease(kind, directory, commit) {
  assert.match(commit, SHA);
  const verification = json(directory, 'verification.json');
  assert.equal(verification.sourceCommit, commit, 'Artifacts must come from the matching verified commit.');
  let title, tag, notes, legacyPrefix, names, checksum;
  if (kind === 'standalone') {
    const manifest = json(directory, 'manifest.json');
    ({ tag } = manifest);
    assert.match(tag, /^standalone-lab-v\d+\.\d+\.\d+$/);
    assert.equal(manifest.projects.length, 8);
    assert.equal(verification.simulatorTests, true);
    assert.deepEqual(verification.projects.map(({ archive }) => archive), manifest.projects.map(({ archive }) => archive));
    for (const project of verification.projects) {
      for (const check of ['cleanInstall', 'unit', 'build', 'browserSmoke']) assert.equal(project[check], true);
    }
    const artifacts = [manifest.shared, ...manifest.projects];
    names = artifacts.map(({ archive, sha256 }) => {
      assert.match(archive, /^(?:[a-z][a-z0-9-]*)-v\d+\.\d+\.\d+\.tgz$/);
      assert.equal(readAsset(directory, archive).digest, sha256, 'Source manifest checksum mismatch for ' + archive);
      return archive;
    });
    title = 'Standalone Engineering Lab ' + tag.slice('standalone-lab-'.length);
    checksum = 'SHA256SUMS';
    notes = readFileSync(join(directory, 'RELEASE-NOTES.md'), 'utf8');
    legacyPrefix = '# Standalone Engineering Lab source exports';
  } else if (kind === 'relayops') {
    ({ tag } = verification);
    assert.match(tag, /^relayops-ai-v\d+\.\d+\.\d+$/);
    title = 'RelayOps AI ' + tag.slice('relayops-ai-'.length);
    names = [tag + '.tgz'];
    checksum = tag + '-SHA256SUMS';
    notes = 'Verified source release for the browser-only demo and local SQLite service. Includes workflow studio, reusable templates, signed webhooks, traces, tests, and Docker Compose.';
    legacyPrefix = notes;
  } else {
    throw new Error('Unknown release kind.');
  }
  assert.equal(verification.tag, tag);
  assert.equal(new Set(names).size, names.length, 'Release archives must have distinct names.');
  const archiveAssets = names.map((name) => readAsset(directory, name));
  const checksums = readAsset(directory, checksum);
  assert.equal(checksums.bytes.toString('utf8').trimEnd(),
    archiveAssets.map(({ digest, name }) => digest + '  ' + name).join('\n'),
    'Release archive checksums do not match.');
  const metadata = kind === 'standalone' ? ['manifest.json', 'verification.json'] : [];
  return {
    tag, title, notes, legacyPrefix, commit,
    assets: [...archiveAssets, checksums, ...metadata.map((name) => readAsset(directory, name))],
  };
}

class ApiFailure extends Error {
  constructor(status, operation, retryable = TRANSIENT.has(status)) {
    super(operation + ' failed with HTTP ' + status);
    this.status = status;
    this.retryable = retryable;
  }
}

export async function publishRelease(candidate, { token, fetcher = fetch, pause = sleep, log = console.log } = {}) {
  assert.ok(token, 'A GitHub Actions token is required.');
  const { tag, title, commit, notes, legacyPrefix, assets } = candidate;
  assert.match(tag, /^(?:standalone-lab|relayops-ai)-v\d+\.\d+\.\d+$/);
  assert.match(commit, SHA);
  const marker = '<!-- portfolio-release-ci:' + tag + ' -->';
  const body = notes.trimEnd() + '\n\n' + marker;
  const auth = { Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' };

  async function request(url, method = 'GET', options = {}) {
    try {
      return await fetcher(url, {
        method,
        ...options,
        signal: AbortSignal.timeout(60_000),
        redirect: options.redirect ?? 'error',
      });
    } catch {
      throw new ApiFailure(503, method + ' GitHub request');
    }
  }

  async function api(path, { method = 'GET', value, missing = false } = {}) {
    const response = await request(API + path, method, {
      headers: { ...auth, Accept: 'application/vnd.github+json', ...(value ? { 'Content-Type': 'application/json' } : {}) },
      ...(value ? { body: JSON.stringify(value) } : {}),
    });
    if (missing && response.status === 404) return null;
    if (!response.ok) {
      const secondaryLimit = response.status === 403 && response.headers.has('retry-after');
      throw new ApiFailure(response.status, method + ' ' + path, secondaryLimit || TRANSIENT.has(response.status));
    }
    return response.json();
  }

  async function retry(operation, canRetry = (error) => error.retryable) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= ATTEMPTS - 1 || !canRetry(error)) throw error;
        await pause(2 ** attempt * 1500);
      }
    }
  }

  const get = (path, options) => retry(() => api(path, options));

  async function list(path) {
    const items = [];
    for (let page = 1; page <= 10; page += 1) {
      const next = await get(path + '?per_page=100&page=' + page);
      assert.ok(Array.isArray(next), 'Expected a GitHub collection.');
      items.push(...next);
      if (next.length < 100) return items;
    }
    throw new Error('Release collection exceeds the safe lookup limit.');
  }

  async function tagCommit() {
    const ref = await get('/git/ref/tags/' + tag, { missing: true });
    if (!ref) return null;
    let { object } = ref;
    for (let depth = 0; object.type === 'tag' && depth < 4; depth += 1) {
      assert.match(object.sha, SHA);
      ({ object } = await get('/git/tags/' + object.sha));
    }
    assert.equal(object.type, 'commit', 'Release tag must resolve to a commit.');
    assert.match(object.sha, SHA);
    return object.sha;
  }

  async function findRelease() {
    const matching = (await list('/releases')).filter(({ tag_name }) => tag_name === tag);
    assert.ok(matching.length <= 1, 'The version has multiple releases and needs inspection.');
    return matching[0];
  }

  async function obtainRelease() {
    return retry(async () => {
      const existing = await findRelease();
      if (existing) return existing;
      assert.equal(await tagCommit(), null, 'Refusing to adopt a tag without an existing release.');
      return api('/releases', {
        method: 'POST',
        value: { tag_name: tag, target_commitish: commit, name: title, body, draft: true, prerelease: false },
      });
    }, (error) => error.retryable || error.status === 422);
  }

  const remoteAssets = (id) => list('/releases/' + id + '/assets');

  async function verifyAsset(actual, expected) {
    assert.equal(actual.name, expected.name);
    assert.equal(actual.state, 'uploaded', 'Incomplete release asset ' + expected.name + ' needs inspection.');
    assert.equal(actual.size, expected.bytes.length, 'Existing release asset size differs for ' + expected.name);
    assert.ok([expected.mediaType, 'application/octet-stream'].includes(actual.content_type),
      'Unexpected media type for ' + expected.name);
    if (actual.digest) {
      assert.equal(actual.digest, 'sha256:' + expected.digest, 'Existing release asset digest differs for ' + expected.name);
      return;
    }
    assert.ok(Number.isSafeInteger(actual.id) && actual.id > 0, 'Invalid release asset ID.');
    await retry(async () => {
      let result = await request(API + '/releases/assets/' + actual.id, 'GET', {
        headers: { ...auth, Accept: 'application/octet-stream' }, redirect: 'manual',
      });
      if (result.status === 302) {
        const target = new URL(result.headers.get('location'));
        assert.ok(target.protocol === 'https:' && (
          ['objects.githubusercontent.com', 'release-assets.githubusercontent.com'].includes(target.hostname)
          || /^github-production-release-asset-[a-z0-9-]+\.s3\.amazonaws\.com$/.test(target.hostname)
        ), 'Unexpected release asset download destination.');
        result = await request(target, 'GET');
      }
      if (!result.ok) throw new ApiFailure(result.status, 'Download release asset');
      const digest = createHash('sha256');
      let size = 0;
      for await (const chunk of result.body) {
        size += chunk.length;
        assert.ok(size <= expected.bytes.length, 'Download exceeds expected asset size.');
        digest.update(chunk);
      }
      assert.equal(size, expected.bytes.length, 'Downloaded asset is incomplete.');
      assert.equal(digest.digest('hex'), expected.digest, 'Downloaded asset digest differs for ' + expected.name);
    });
  }

  async function uploadMissing(id, expected) {
    await retry(async () => {
      const current = (await remoteAssets(id)).find(({ name }) => name === expected.name);
      if (current) {
        await verifyAsset(current, expected);
        return;
      }
      const url = new URL(UPLOADS + '/releases/' + id + '/assets');
      url.searchParams.set('name', expected.name);
      url.searchParams.set('label', expected.label);
      const response = await request(url, 'POST', {
        headers: {
          Authorization: auth.Authorization, 'Content-Type': expected.mediaType,
          'Content-Length': String(expected.bytes.length),
        },
        body: expected.bytes,
      });
      if (!response.ok) throw new ApiFailure(response.status, 'Upload ' + expected.name);
      await verifyAsset(await response.json(), expected);
    }, (error) => error.retryable || error.status === 422);
  }

  const repo = await get('');
  assert.equal(repo.full_name, REPO, 'The authenticated workflow resolved the wrong repository.');
  const release = await obtainRelease();
  assert.ok(Number.isSafeInteger(release.id) && release.id > 0, 'Invalid release ID.');
  assert.equal(release.tag_name, tag);
  if (!release.draft) {
    const existing = await remoteAssets(release.id);
    assert.ok(await tagCommit(), 'Published release is missing its Git tag.');
    for (const { name } of assets) {
      assert.ok(existing.some((asset) => asset.name === name && asset.state === 'uploaded' && asset.size > 0),
        'Published release is missing ' + name);
    }
    log(tag + ' is already published. No assets changed.');
    return;
  }
  assert.ok(release.author?.login === 'github-actions[bot]' &&
    (release.body?.includes(marker) || (release.name === title && release.body?.startsWith(legacyPrefix))),
  'Refusing to modify a draft without portfolio CI ownership.');
  const initialTag = await tagCommit();
  assert.ok(initialTag === null || initialTag === commit, 'An existing Git tag targets a different commit.');
  for (const asset of await remoteAssets(release.id)) {
    const expected = assets.find(({ name }) => name === asset.name);
    assert.ok(expected, 'Unexpected asset in existing draft: ' + asset.name);
    await verifyAsset(asset, expected);
  }
  for (const asset of assets) await uploadMissing(release.id, asset);
  const uploaded = await remoteAssets(release.id);
  for (const asset of assets) {
    const record = uploaded.find(({ name }) => name === asset.name);
    assert.ok(record, 'Missing verified release asset ' + asset.name);
    await verifyAsset(record, asset);
  }
  const complete = await retry(async () => {
    const current = await get('/releases/' + release.id);
    if (!current.draft) return current;
    const actualTag = await tagCommit();
    assert.ok(actualTag === null || actualTag === commit, 'Git tag changed before publication.');
    return api('/releases/' + release.id, {
      method: 'PATCH',
      value: { draft: false, target_commitish: commit, body, make_latest: 'false' },
    });
  });
  assert.equal(complete.draft, false, 'GitHub did not publish the verified draft.');
  assert.equal(await retry(async () => {
    const target = await tagCommit();
    if (!target) throw new ApiFailure(503, 'Read the published release tag');
    return target;
  }), commit, 'Published release tag does not point at the verified commit.');
  log('Published ' + tag + ' with ' + assets.length + ' verified assets.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv.length, 4, 'Usage: node tools/publish-release.mjs <standalone|relayops> <asset-directory>');
  assert.equal(process.env.GH_REPO, REPO, 'Publication is restricted to the personal portfolio repository.');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Release publication requires main.');
  const prepared = prepareRelease(process.argv[2], process.argv[3], process.env.GITHUB_SHA);
  await publishRelease(prepared, { token: process.env.GH_TOKEN });
}
