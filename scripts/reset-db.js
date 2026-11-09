#!/usr/bin/env node
/**
 * npm run db:reset            (asks for confirmation)
 * npm run db:reset -- --yes   (no question)
 * Drops the development database, deletes uploaded photos, then reseeds.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import '../apps/server/src/models/index.js';
import { REPO_ROOT } from '../apps/server/src/config/env.js';
import { seedDatabase } from '../apps/server/src/seed/seed.js';
import { connect, ask, mongoUri } from './lib.js';

const uri = mongoUri();
if (/prod|atlas|mongodb\+srv/i.test(uri)) {
  console.error(`Refusing to reset what looks like a non-local database: ${uri}`);
  process.exit(1);
}

if (!process.argv.includes('--yes')) {
  const answer = await ask(`This deletes ALL data in ${uri} and all uploaded photos. Type "reset" to continue: `);
  if (answer !== 'reset') {
    console.log('Cancelled. Nothing was changed.');
    process.exit(0);
  }
}

await connect();
await mongoose.connection.dropDatabase();
const uploadDir = path.resolve(REPO_ROOT, process.env.UPLOAD_DIR || 'apps/server/uploads');
await fs.rm(path.join(uploadDir, 'avatars'), { recursive: true, force: true });
console.log('Database dropped and uploads cleared. Reseeding…');
await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
await seedDatabase({ password: process.env.SEED_DEMO_PASSWORD || 'Demo@1234', log: console.log });
await mongoose.disconnect();
