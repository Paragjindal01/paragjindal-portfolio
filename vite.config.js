import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { portfolioMetadata } from './src/data/seo.mjs';
import { simulationResponse } from './api/simulation.js';

function simulationMiddleware(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname !== '/api/simulation') {
    next();
    return;
  }
  const response = simulationResponse(url, req.method);
  response.text().then((body) => {
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(body);
  }, next);
}

const localSimulationApi = {
  name: 'local-simulation-api',
  configureServer(server) { server.middlewares.use(simulationMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(simulationMiddleware); },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), portfolioMetadata(), localSimulationApi],
});
