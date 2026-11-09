/** Helpers shared by the scripts in this folder. */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import mongoose from 'mongoose';
import { loadEnvFiles } from '../apps/server/src/config/env.js';

export function mongoUri() {
  loadEnvFiles();
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillbridge_dev';
}

export async function connect() {
  const uri = mongoUri();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error(`\n✖ Could not connect to MongoDB at ${uri}`);
    console.error('  Start it first:  brew services start mongodb-community');
    console.error(`  (${err.message})\n`);
    process.exit(1);
  }
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  return uri;
}

export async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
