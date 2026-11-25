export const statusWords = { waiting: 'Waiting for approval', queued: 'Queued', running: 'Running', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped' };
export const typeWords = { trigger: 'Trigger', agent: 'Agent', api: 'API request', transform: 'Transform', condition: 'Condition', validate: 'Validation', approval: 'Approval', document: 'Document', notification: 'Notification' };
export const ACTIVE = new Set(['queued', 'running', 'waiting']);
export const pretty = (value) => JSON.stringify(value, null, 2);
export const titleWords = (value) => String(value).replace(/[-_.]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
export function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}
export function durationMs(value) {
  if (!Number.isFinite(value) || value < 0) return '—';
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}
export function parseObject(text, label = 'Input') {
  let value;
  try { value = JSON.parse(text); } catch { throw Error(`${label} must be valid JSON.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(`${label} must be a JSON object.`);
  return value;
}
