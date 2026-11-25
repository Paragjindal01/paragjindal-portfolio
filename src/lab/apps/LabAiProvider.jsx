import { aiProviderAvailable } from './lab-ai-client.mjs';

export function AiProvider({ value, onChange }) {
  if (!aiProviderAvailable()) return null;
  return (
    <label>Answer provider <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="offline">Offline</option>
      <option value="ollama">Local Ollama</option>
      {import.meta.env.VITE_LAB_AI_EXTERNAL === '1' && <option value="external">External model (sends context)</option>}
    </select></label>
  );
}
