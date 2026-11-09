import { ACCOUNT_STATUS, ERROR_CODES } from '@skillbridge/shared';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken, ACCESS_COOKIE } from '../services/tokenService.js';

/**
 * Guards every protected endpoint (SB1/US11, US13).
 * 1. access cookie present   → else 401 UNAUTHENTICATED
 * 2. JWT signature + expiry  → else 401 TOKEN_EXPIRED / UNAUTHENTICATED
 * 3. user exists and active  → else 401 / 403 ACCOUNT_DEACTIVATED
 * 4. token version matches   → else 401 (password was changed)
 */
export async function authenticate(req, _res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) throw AppError.unauthenticated();

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).select('role status tokenVersion').lean();
  if (!user) throw AppError.unauthenticated('Your account no longer exists.');
  if (user.status !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError(403, ERROR_CODES.ACCOUNT_DEACTIVATED, 'This account has been deactivated.');
  }
  if (payload.tv !== user.tokenVersion) {
    throw AppError.unauthenticated('Your session has ended. Please log in again.');
  }

  req.user = { id: String(user._id), role: user.role };
  next();
}

/** Allows only the given roles (SB1/US47–49). Must run after authenticate. */
export function authorize(...roles) {
  return function authorizeRole(req, _res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden('This area is only available to administrators.');
    }
    next();
  };
}
