/**
 * Starts ONE throwaway MongoDB for the whole integration run.
 * Each test file then uses its own randomly named database inside it, so files
 * can run in parallel without seeing each other's data.
 *
 * On a Mac, mongodb-memory-server downloads a MongoDB binary the first time
 * (~100 MB, cached afterwards). Set MONGOMS_SYSTEM_BINARY to reuse an installed mongod.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup({ provide }) {
  mongod = await MongoMemoryServer.create();
  provide('mongoUri', mongod.getUri());
}

export async function teardown() {
  await mongod?.stop();
}
