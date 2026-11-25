import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const directory = fileURLToPath(new URL('.', import.meta.url));
const backend = 'http://127.0.0.1:4174';

export default defineConfig({
  root: `${directory}web`,
  envDir: directory,
  base: '/relayops/',
  plugins: [react()],
  server: { port: 4371, proxy: { '/api': backend }, fs: { allow: [directory] } },
  preview: { port: 4371, proxy: { '/api': backend } },
  build: { outDir: `${directory}dist`, emptyOutDir: true },
});
