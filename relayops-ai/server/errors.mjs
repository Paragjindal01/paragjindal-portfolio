export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'invalid_input', name + ' must be a JSON object.');
  }
  return value;
}

export function boundedJson(value, maxBytes, name) {
  let raw;
  try { raw = JSON.stringify(value ?? null); } catch {
    throw new ApiError(422, 'invalid_result', name + ' must be serializable as JSON.');
  }
  if (Buffer.byteLength(raw) > maxBytes) throw new ApiError(413, 'content_limit', name + ' exceeds the size limit.');
  return raw;
}
