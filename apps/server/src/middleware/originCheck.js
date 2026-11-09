import { ERROR_CODES } from '@skillbridge/shared';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth: a state-changing request that carries an Origin header
 * must come from the app itself. SameSite cookies are the first line of defence.
 */
export function originCheck(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return function checkOrigin(req, _res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next(); // non-browser clients (curl, tests) send no Origin
    const self = `${req.protocol}://${req.get('host')}`;
    if (origin === self || allowed.has(origin)) return next();
    throw new AppError(403, ERROR_CODES.CSRF_REJECTED, 'This request came from an unexpected website and was blocked.');
  };
}
