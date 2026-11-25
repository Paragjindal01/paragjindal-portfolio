import { ApiError } from './errors.mjs';

function rejectJson(code, message) {
  throw new ApiError(400, code, message);
}

function validateJson(data) {
  const pending = [{ value: data, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop();
    visited += 1;
    if (depth > 32 || visited > 30_000) rejectJson('invalid_json', 'JSON nesting or item count exceeded its limit.');
    if (typeof value === 'number' && !Number.isFinite(value)) rejectJson('invalid_json', 'JSON numbers must be finite.');
    if (value == null || typeof value !== 'object') continue;
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) rejectJson('invalid_json', 'The JSON document contains a reserved object key.');
      pending.push({ value: child, depth: depth + 1 });
    }
  }
}

export function parseJsonBody(bytes) {
  let data;
  try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch {
    rejectJson('invalid_json', 'The request body is not valid UTF-8 JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) rejectJson('invalid_json', 'Send a JSON object.');
  validateJson(data);
  return data;
}
