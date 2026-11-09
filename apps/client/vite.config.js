import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(import.meta.dirname, '../..');

/** `npm run dev:https` sets HTTPS=true and uses mkcert certificates from /certs (SB1/US45). */
function httpsOptions() {
  if (process.env.HTTPS !== 'true') return undefined;
  const cert = path.join(repoRoot, 'certs/localhost.pem');
  const key = path.join(repoRoot, 'certs/localhost-key.pem');
  if (!fs.existsSync(cert) || !fs.existsSync(key)) {
    throw new Error('HTTPS=true but certs/localhost.pem is missing. See README → "Local HTTPS".');
  }
  return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) };
}

const https = httpsOptions();
const apiTarget = `${https ? 'https' : 'http'}://localhost:${process.env.API_PORT ?? 5000}`;
// The proxy makes the browser see one origin, so cookies work without CORS tricks.
const proxy = {
  '/api': { target: apiTarget, secure: false },
  '/uploads': { target: apiTarget, secure: false },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, https, proxy },
  preview: { port: 4173, strictPort: true, https, proxy },
  build: { sourcemap: true, chunkSizeWarningLimit: 900 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
      reporter: ['text-summary', 'json-summary', 'html'],
    },
  },
});
