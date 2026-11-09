/**
 * Registration, login, logout, refresh and password management
 * (SB1/US1–US14). Controllers stay thin; every rule lives here.
 */
import { ACCOUNT_STATUS, DEACTIVATED_BY, ERROR_CODES } from '@skillbridge/shared';
import { User } from '../models/User.js';
import { PasswordReset } from '../models/PasswordReset.js';
import { runtime } from '../config/runtime.js';
import { AppError } from '../utils/AppError.js';
import { generateOpaqueToken, hashToken } from '../utils/crypto.js';
import { hashPassword, verifyPassword, verifyAgainstDummy } from './passwordService.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from './tokenService.js';
import { passwordResetEmail, passwordChangedEmail } from '../integrations/mail/templates.js';
import { logger } from '../utils/logger.js';

const INVALID_LOGIN_MESSAGE = 'The email or password is incorrect.';

/** SB1/US1, US2, US9, US14 – creates the account with a bcrypt hash. */
export async function register({ name, email, password, timezone }) {
  const existing = await User.exists({ email });
  if (existing) {
    throw AppError.conflict(ERROR_CODES.EMAIL_TAKEN, 'An account with this email already exists.', {
      fields: { email: 'An account with this email already exists. Try logging in instead.' },
    });
  }
  const passwordHash = await hashPassword(password);
  return User.create({ name, email, passwordHash, timezone: timezone ?? 'UTC', lastLoginAt: new Date() });
}

/**
 * SB1/US3 – checks credentials. The same message is used for an unknown email
 * and a wrong password so attackers cannot discover which emails exist.
 * Self-deactivated users may reactivate by logging in with `reactivate: true` (SB1/US32).
 */
export async function login({ email, password, reactivate = false }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    await verifyAgainstDummy(password);
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, INVALID_LOGIN_MESSAGE);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, INVALID_LOGIN_MESSAGE);

  if (user.status === ACCOUNT_STATUS.DEACTIVATED) {
    const canReactivate = user.deactivation?.by === DEACTIVATED_BY.SELF;
    if (!(canReactivate && reactivate)) {
      throw new AppError(
        403,
        ERROR_CODES.ACCOUNT_DEACTIVATED,
        canReactivate
          ? 'You deactivated this account. Reactivate it to continue.'
          : 'This account has been deactivated by an administrator. Contact support if you think this is a mistake.',
        { details: { canReactivate } },
      );
    }
    user.status = ACCOUNT_STATUS.ACTIVE;
    user.deactivation = null;
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/** Issues a new access token + refresh token pair for a freshly authenticated user. */
export async function startSession(user, { userAgent } = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user._id, { userAgent });
  return { accessToken, refreshToken };
}

/** SB1/US10, US12 – swaps the refresh token for a new pair. */
export async function refreshSession(rawRefreshToken, { userAgent } = {}) {
  const { userId, refreshToken } = await rotateRefreshToken(rawRefreshToken, { userAgent });
  const user = await User.findById(userId);
  if (!user || user.status !== ACCOUNT_STATUS.ACTIVE) {
    await revokeAllRefreshTokens(userId);
    throw AppError.unauthenticated('Your session has ended. Please log in again.');
  }
  return { user, accessToken: signAccessToken(user), refreshToken };
}

/** SB1/US4 – revokes the refresh token so the session cannot be renewed. */
export async function logout(rawRefreshToken) {
  await revokeRefreshToken(rawRefreshToken);
}

/**
 * SB1/US5, US6 – always succeeds from the caller's point of view.
 * If the account exists and is active, an email with a single-use link is sent.
 */
export async function requestPasswordReset(email) {
  const { config, mailer } = runtime();
  const user = await User.findOne({ email, status: ACCOUNT_STATUS.ACTIVE });
  if (!user) return;

  await PasswordReset.deleteMany({ user: user._id });
  const raw = generateOpaqueToken();
  await PasswordReset.create({
    user: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + config.PASSWORD_RESET_TTL_MINUTES * 60_000),
  });

  const link = `${config.clientOrigins[0]}/reset-password/${raw}`;
  try {
    await mailer.send({
      to: user.email,
      ...passwordResetEmail({ name: user.name, link, minutes: config.PASSWORD_RESET_TTL_MINUTES }),
    });
  } catch (err) {
    logger.error('Could not send the password reset email', err);
  }
}

/** SB1/US6 – sets the new password, burns the token and signs out every device. */
export async function resetPassword({ token, password }) {
  const reset = await PasswordReset.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  const user = reset ? await User.findById(reset.user) : null;
  if (!reset || !user || user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError(
      400,
      ERROR_CODES.RESET_TOKEN_INVALID,
      'This reset link is invalid or has expired. Please request a new one.',
    );
  }

  user.passwordHash = await hashPassword(password);
  user.tokenVersion += 1;
  await user.save();
  reset.usedAt = new Date();
  await reset.save();
  await revokeAllRefreshTokens(user._id);
  await notifyPasswordChanged(user);
}

/** SB1/US7 – needs the current password; other devices are signed out. */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.unauthenticated();
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw AppError.validation({ currentPassword: 'Your current password is incorrect' });

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  await revokeAllRefreshTokens(user._id);
  await notifyPasswordChanged(user);
  return user;
}

async function notifyPasswordChanged(user) {
  try {
    await runtime().mailer.send({ to: user.email, ...passwordChangedEmail({ name: user.name }) });
  } catch (err) {
    logger.error('Could not send the password-changed email', err);
  }
}
