/**
 * One Axios instance for the whole app.
 * - Sends cookies (withCredentials), so the HTTP-only login cookies travel automatically.
 * - When a request fails with 401, it calls POST /auth/refresh ONCE (even if several
 *   requests failed together) and retries the original request (SB1/US10, US12).
 * - Every failure becomes an ApiError with { status, code, message, fields } (SB1/US42).
 */
import axios from 'axios';

export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message, fields, details } = {}) {
    super(message ?? 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields ?? null;
    this.details = details ?? null;
  }
}

export function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (error?.response) {
    const body = error.response.data?.error ?? {};
    return new ApiError({
      status: error.response.status,
      code: body.code ?? 'HTTP_ERROR',
      message: body.message ?? 'Something went wrong on our side. Please try again.',
      fields: body.fields,
      details: body.details,
    });
  }
  return new ApiError({
    status: 0,
    code: 'NETWORK_ERROR',
    message: "We can't reach the SkillBridge server right now. Check your connection and try again.",
  });
}

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

/** Auth endpoints that must never trigger an automatic refresh. */
const NO_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshInFlight = null;
let sessionExpiredHandler = () => {};

/** AuthContext registers what happens when the session cannot be renewed. */
export function onSessionExpired(handler) {
  sessionExpiredHandler = handler;
}

function refreshOnce() {
  // Send `{}`, not `null`: Express's strict JSON parser rejects a bare `null` body.
  refreshInFlight ??= api.post('/auth/refresh', {}, { _skipRefresh: true }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config ?? {};
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const eligible =
      status === 401 &&
      (code === 'TOKEN_EXPIRED' || code === 'UNAUTHENTICATED') &&
      !config._retried &&
      !config._skipRefresh &&
      !NO_REFRESH.some((path) => config.url?.startsWith(path));

    if (!eligible) throw toApiError(error);

    config._retried = true;
    try {
      await refreshOnce();
    } catch (refreshError) {
      sessionExpiredHandler();
      throw toApiError(error);
    }
    return api(config);
  },
);

/** Unwraps the { success, data, meta } envelope. */
export async function request(promise) {
  const res = await promise;
  return { data: res.data?.data, meta: res.data?.meta };
}
