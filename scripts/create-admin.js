#!/usr/bin/env node
/**
 * npm run create-admin
 * Creates an administrator account. Admins can never sign up through the website.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { emailSchema, nameSchema, passwordSchema } from '@skillbridge/shared';
import { User } from '../apps/server/src/models/index.js';
import { connect, ask } from './lib.js';

function check(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    console.error(`✖ ${result.error.issues[0].message}`);
    process.exit(1);
  }
  return result.data;
}

const name = check(nameSchema, await ask('Admin name: '));
const email = check(emailSchema, await ask('Admin email: '));
const password = check(passwordSchema, await ask('Password (8–72 chars, upper, lower, number, symbol): '));

await connect();
if (await User.exists({ email })) {
  await User.updateOne({ email }, { $set: { role: 'admin' } });
  console.log(`✔ ${email} already existed and is now an administrator.`);
} else {
  await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'admin', timezone: 'UTC' });
  console.log(`✔ Administrator ${email} created.`);
}
await mongoose.disconnect();
