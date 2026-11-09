import crypto from 'node:crypto';

/** 256-bit random token, URL-safe. Used for refresh and password-reset tokens. */
export const generateOpaqueToken = () => crypto.randomBytes(32).toString('base64url');

/** Only hashes of tokens are stored, so a database leak cannot be replayed. */
export const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const randomId = () => crypto.randomUUID();
