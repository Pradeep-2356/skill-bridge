import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

/** Connects to MongoDB and makes sure every model's indexes exist. */
export async function connectDatabase(uri, { syncIndexes = true } = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  if (syncIndexes) {
    await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
  }
  logger.info(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/** 'up' when the driver reports a live connection. Used by GET /health. */
export function databaseStatus() {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
}
