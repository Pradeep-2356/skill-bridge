#!/usr/bin/env node
/**
 * npm run setup
 * Creates .env from .env.example with a fresh random JWT secret.
 * Never overwrites an existing .env.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 22)) {
  console.warn(
    `⚠ Node.js ${process.versions.node} detected. SkillBridge needs Node.js 22.22 or newer (24 LTS recommended).`,
  );
}

if (fs.existsSync(envPath)) {
  console.log('✔ .env already exists – leaving it unchanged.');
} else {
  const secret = crypto.randomBytes(48).toString('hex');
  const content = fs
    .readFileSync(examplePath, 'utf8')
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET=${secret}`);
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  console.log('✔ Created .env with a new random JWT secret.');
}

console.log(`
Next steps
  1. Start MongoDB:   brew services start mongodb-community
  2. (Optional) Mailpit for reset emails:  brew services start mailpit  → http://localhost:8025
  3. Add demo data:   npm run db:seed
  4. Run the app:     npm run dev   → http://localhost:5173
`);
