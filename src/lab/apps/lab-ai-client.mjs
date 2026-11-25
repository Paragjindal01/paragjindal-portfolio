const endpoint = import.meta.env.VITE_LAB_AI_ENDPOINT || '';
const isLocalFrontend = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const configured = /^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(endpoint);

export const aiProviderAvailable = () => configured && isLocalFrontend();

export async function requestAi(kind, request) {
  if (!configured || !isLocalFrontend() || !['infrapilot', 'localmind'].includes(kind)) throw new Error('The local model service is unavailable.');
  const response = await fetch(endpoint + '/' + kind, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(55_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The model service did not respond successfully.');
  if (body.provider !== request.provider || typeof body.text !== 'string' || !body.text) throw new Error('The model service returned an invalid response.');
  return body;
}
