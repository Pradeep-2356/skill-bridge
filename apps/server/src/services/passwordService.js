import bcrypt from 'bcryptjs';
import { runtime } from '../config/runtime.js';

/** bcrypt hash with the configured cost (12 in development, 4 in tests) – SB1/US14. */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, runtime().config.BCRYPT_COST);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

// Comparing against a real hash when the email is unknown keeps login timing
// the same for existing and non-existing accounts (no account enumeration).
let dummyHash = null;

export async function verifyAgainstDummy(plain) {
  dummyHash ??= await bcrypt.hash('skillbridge-timing-equaliser', runtime().config.BCRYPT_COST);
  await bcrypt.compare(plain ?? '', dummyHash);
  return false;
}
