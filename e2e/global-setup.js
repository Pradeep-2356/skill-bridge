/**
 * Empties the e2e database (keeping indexes) and loads the demo data, so every
 * run starts from the same known state.
 */
import mongoose from 'mongoose';
import '../apps/server/src/models/index.js';
import { seedDatabase } from '../apps/server/src/seed/seed.js';

export default async function globalSetup() {
  const uri = process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/skillbridge_e2e';
  if (!/_e2e|e2e_/.test(uri)) throw new Error(`Refusing to wipe a database that is not an e2e database: ${uri}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  await seedDatabase({ password: 'Demo@1234', bcryptCost: 8 });
  await mongoose.disconnect();
}
