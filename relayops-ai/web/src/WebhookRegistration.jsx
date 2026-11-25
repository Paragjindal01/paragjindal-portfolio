import { useEffect, useState } from 'react';
import { client } from './client.mjs';
import { formatDate } from './format.mjs';

const requiresSignature = ({ workflow }) => workflow.nodes.some((node) => node.type === 'trigger' && node.config?.operation === 'webhook');
const endpoint = (webhook) => `${window.location.origin}${webhook.path}`;

export default function WebhookRegistration() {
  const [workflows, setWorkflows] = useState(null);
  const [webhooks, setWebhooks] = useState(null);
  const [workflowId, setWorkflowId] = useState('');
  const [versions, setVersions] = useState(null);
  const [version, setVersion] = useState('');
  const [created, setCreated] = useState(null);
  const [confirmId, setConfirmId] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([client.workflows(), client.webhooks()]).then(([definitions, registrations]) => {
      if (!active) return;
      setWorkflows(definitions);
      setWebhooks(registrations);
    }).catch((issue) => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workflowId) return undefined;
    let active = true;
    client.versions(workflowId).then((revisions) => {
      if (active) setVersions(revisions.filter(requiresSignature));
    }).catch((issue) => { if (active) setError(issue.message); });
    return () => { active = false; };
  }, [workflowId]);

  function chooseWorkflow(event) {
    setWorkflowId(event.target.value);
    setVersions(null);
    setVersion('');
    setInfo('');
    setError('');
  }

  async function register(event) {
    event.preventDefault();
    if (!versions?.some((item) => item.version === Number(version))) return;
    setBusy(true);
    setCreated(null);
    setError('');
    setInfo('');
    try {
      const registration = await client.registerWebhook({ workflowId, version: Number(version) });
      setCreated(registration);
      setWebhooks((items) => [...items, registration.webhook]);
      setInfo('Webhook registered.');
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await client.revokeWebhook(id);
      setWebhooks((items) => items.filter((item) => item.id !== id));
      if (created?.webhook.id === id) setCreated(null);
      setConfirmId('');
      setInfo('Webhook revoked.');
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel webhook-panel" aria-labelledby="webhook-heading">
    <div className="section-heading"><h2 id="webhook-heading">Signed webhooks</h2><p>Receive signed JSON and start an offline execution of a pinned workflow version. A registration expires with its local session.</p></div>
    {error && <p className="notice failure" role="alert">{error}</p>}
    {info && <p className="notice success" role="status">{info}</p>}
    {workflows === null && !error && <p className="muted">Loading saved workflows and registrations…</p>}
    {workflows?.length === 0 && <p className="muted">In Workflow Studio, set the trigger operation to Webhook and save a version to register an endpoint.</p>}
    {workflows?.length > 0 && <form className="webhook-form" onSubmit={register}>
      <label>Webhook workflow<select value={workflowId} onChange={chooseWorkflow} required disabled={busy}><option value="">Choose a saved workflow</option>{workflows.map(({ workflow }) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label>
      <label>Webhook version<select value={version} onChange={(event) => setVersion(event.target.value)} required disabled={busy || !versions?.length}><option value="">{workflowId && versions === null ? 'Loading versions…' : 'Choose webhook version'}</option>{versions?.map((item) => <option key={item.version} value={item.version}>Version {item.version}</option>)}</select></label>
      <button type="submit" className="button primary" disabled={busy || !version}>Register webhook</button>
    </form>}
    {versions?.length === 0 && <p className="muted">This workflow has no saved versions with a Webhook trigger. Change its trigger in Workflow Studio and save a version.</p>}
    {created && <div className="webhook-secret">
      <div><strong>Signing secret</strong><button type="button" className="small-button" onClick={() => setCreated(null)}>Hide signing secret</button></div>
      <p className="muted">Copy this value into your sender now. RelayOps shows it only at registration.</p>
      <code aria-label="One-time signing secret">{created.secret}</code>
    </div>}
    <h3>Active registrations</h3>
    {webhooks?.length === 0 && <p className="muted">No endpoints are registered for this session.</p>}
    {webhooks?.length > 0 && <ul className="webhook-list">{webhooks.map((item) => <li key={item.id}>
      <div><strong>{workflows?.find(({ workflow }) => workflow.id === item.workflowId)?.workflow.name || item.workflowId} · Version {item.version}</strong><span className="muted">Expires {formatDate(item.expiresAt)}</span><code aria-label="Delivery endpoint">{endpoint(item)}</code></div>
      {confirmId === item.id ? <div className="button-row"><button type="button" className="button danger" onClick={() => revoke(item.id)} disabled={busy}>Confirm revoke</button><button type="button" className="small-button" onClick={() => setConfirmId('')} disabled={busy}>Keep registration</button></div> : <button type="button" className="button danger" onClick={() => setConfirmId(item.id)} disabled={busy}>Revoke webhook</button>}
    </li>)}</ul>}
    <details className="studio-details webhook-signing"><summary>Signing deliveries</summary><div>
      <p>Send a JSON object by POST with <code>Content-Type: application/json</code>, <code>X-RelayOps-Timestamp</code> in Unix seconds, and a unique <code>Idempotency-Key</code>. Reuse the same key when retrying an identical delivery.</p>
      <p>Set <code>X-RelayOps-Signature</code> to <code>sha256=</code> followed by the lowercase HMAC-SHA256 hex digest. Decode the signing secret as Base64URL. Sign the four newline-terminated values below followed by the unchanged request body bytes.</p>
      <pre className="json-block" tabIndex={0}>{'relayops-webhook-v1\n<registration ID>\n<timestamp>\n<idempotency key>\n<raw JSON body>'}</pre>
    </div></details>
  </section>;
}
