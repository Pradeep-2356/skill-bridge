/**
 * Access tokens (JWT, 15 min) and refresh tokens (opaque, 7 days, rotated).
 * See the Stage 3 proposal, "Authentication and authorization".
 */
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@skillbridge/shared';
import { RefreshToken } from '../models/RefreshToken.js';
import { runtime } from '../config/runtime.js';
import { durationToMs } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { generateOpaqueToken, hashToken, randomId } from '../utils/crypto.js';

export const ACCESS_COOKIE = 'sb_access';
export const REFRESH_COOKIE = 'sb_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

const ISSUER = 'skillbridge';
const AUDIENCE = 'skillbridge-web';

// ───────────── access token (JWT) ─────────────

export function signAccessToken(user) {
  const { config } = runtime();
  return jwt.sign({ role: user.role, tv: user.tokenVersion ?? 0 }, config.JWT_ACCESS_SECRET, {
    subject: String(user._id ?? user.id),
    expiresIn: Math.floor(durationToMs(config.ACCESS_TOKEN_TTL) / 1000),
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256',
  });
}

/** Returns the payload or throws 401 TOKEN_EXPIRED / UNAUTHENTICATED (SB1/US12). */
export function verifyAccessToken(token) {
  const { config } = runtime();
  try {
    return jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Your session has expired. Please log in again.');
    }
    throw AppError.unauthenticated('Your session is not valid. Please log in again.');
  }
}

// ───────────── refresh token (opaque, rotated) ─────────────

function refreshTtlMs() {
  return runtime().config.REFRESH_TOKEN_TTL_DAYS * 86_400_000;
}

/** Creates and stores (hash only) a new refresh token; returns the raw token for the cookie. */
export async function issueRefreshToken(userId, { family = randomId(), userAgent = '' } = {}) {
  const raw = generateOpaqueToken();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    family,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    userAgent: String(userAgent).slice(0, 300),
  });
  return raw;
}

/**
 * Swaps a refresh token for a new one (rotation).
 * A token that was already used means someone may have copied it, so every
 * token from that login ("family") is revoked and the caller must log in again.
 */
export async function rotateRefreshToken(raw, { userAgent = '' } = {}) {
  if (!raw) throw AppError.unauthenticated();
  const tokenHash = hashToken(raw);
  const now = new Date();

  // Atomically mark this token as used so two parallel calls cannot both succeed.
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
    { returnDocument: 'before' },
  );

  if (!current) {
    const known = await RefreshToken.findOne({ tokenHash });
    if (known?.revokedAt) {
      await RefreshToken.updateMany({ family: known.family, revokedAt: null }, { $set: { revokedAt: now } });
    }
    throw AppError.unauthenticated('Your session has ended. Please log in again.');
  }

  const nextRaw = await issueRefreshToken(current.user, { family: current.family, userAgent });
  await RefreshToken.updateOne({ _id: current._id }, { $set: { replacedByHash: hashToken(nextRaw) } });
  return { userId: current.user, refreshToken: nextRaw };
}

export async function revokeRefreshToken(raw) {
  if (!raw) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(raw), revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeAllRefreshTokens(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

// ───────────── cookies ─────────────

function baseCookieOptions() {
  const { config } = runtime();
  return { httpOnly: true, secure: config.cookieSecure };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  const { config } = runtime();
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookieOptions(),
    sameSite: 'lax',
    path: '/',
    maxAge: durationToMs(config.ACCESS_TOKEN_TTL),
  });
  if (refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseCookieOptions(),
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: refreshTtlMs(),
    });
  }
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookieOptions(), sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookieOptions(), sameSite: 'strict', path: REFRESH_COOKIE_PATH });
}
