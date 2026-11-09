#!/usr/bin/env node
/**
 * npm run db:seed
 * Adds categories, the skill catalogue, demo users and demo sessions.
 * Safe to run more than once: it only adds what is missing.
 */
import mongoose from 'mongoose';
import '../apps/server/src/models/index.js';
import { seedDatabase } from '../apps/server/src/seed/seed.js';
import { connect } from './lib.js';

const uri = await connect();
const password = process.env.SEED_DEMO_PASSWORD || 'Demo@1234';
console.log(`Seeding ${uri} …`);
await seedDatabase({ password, log: console.log });
console.log(`\nDemo accounts (password: ${password})`);
console.log('  admin@skillbridge.test   – administrator');
console.log('  priya@skillbridge.test   – mentor (React, JavaScript, UI design)');
console.log('  arjun@skillbridge.test   – learner (wants React, teaches Python)');
console.log('  + 26 more members across 6 time zones\n');
await mongoose.disconnect();
