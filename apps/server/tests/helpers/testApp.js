import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';
import { buildConfig } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';

/**
 * Connects to a fresh database for this test file and builds the real Express app
 * with an in-memory mailer and a temporary upload folder.
 */
export async function setupTestApp(envOverrides = {}) {
  const uri = inject('mongoUri');
  const dbName = `test_${crypto.randomUUID().replace(/-/g, '')}`;
  await mongoose.connect(uri, { dbName });

  const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skillbridge-uploads-'));
  const config = buildConfig({ ...process.env, UPLOAD_DIR: uploadDir, ...envOverrides });
  const app = createApp(config);
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  return { app, config, mailer: app.locals.runtime.mailer, storage: app.locals.runtime.storage, uploadDir };
}

/** Empties every collection (indexes stay). Call in beforeEach. */
export async function resetDatabase() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function teardownTestApp(ctx) {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (ctx?.uploadDir) await fs.rm(ctx.uploadDir, { recursive: true, force: true });
}
