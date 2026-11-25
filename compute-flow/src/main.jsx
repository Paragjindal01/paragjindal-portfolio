import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';
import {
  CLUSTER_PRESETS,
  POLICY_PRESETS,
  comparePolicies,
  generateWorkload,
  recommendPolicy,
  simulate,
} from './core/simulator.mjs';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App
      presets={CLUSTER_PRESETS}
      policies={POLICY_PRESETS}
      generateWorkloads={generateWorkload}
      simulate={simulate}
      comparePolicies={comparePolicies}
      recommend={recommendPolicy}
    />
  </StrictMode>,
);
