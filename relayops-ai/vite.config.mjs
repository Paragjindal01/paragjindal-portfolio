import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const directory = fileURLToPath(new URL('.', import.meta.url));
const backend = 'http://127.0.0.1:4174';
const productionPolicy = {
  name: 'relayops-document-policy',
  apply: 'build',
  transformIndexHtml() {
    return [{ tag: 'meta', injectTo: 'head-prepend', attrs: {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
    } }];
  },
};

export default defineConfig({
  root: `${directory}web`,
  envDir: directory,
  base: '/relayops/',
  plugins: [react(), productionPolicy],
  server: { port: 4371, proxy: { '/api': backend }, fs: { allow: [directory] } },
  preview: { port: 4371, proxy: { '/api': backend } },
  build: { outDir: `${directory}dist`, emptyOutDir: true },
});
