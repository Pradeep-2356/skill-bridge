import { describe, it, expect, vi } from 'vitest';
import { server, http, API, ok, fail } from '../test/server.js';
import { api, request, onSessionExpired, toApiError, ApiError } from './apiClient.js';

describe('API client (SB1/US10, US12, US42)', () => {
  it('refreshes once when several requests fail with 401 together, then retries them', async () => {
    let refreshed = 0;
    let authorised = false;
    server.use(
      http.get(`${API}/a`, () => (authorised ? ok({ a: 1 }) : fail(401, 'TOKEN_EXPIRED', 'expired'))),
      http.get(`${API}/b`, () => (authorised ? ok({ b: 2 }) : fail(401, 'TOKEN_EXPIRED', 'expired'))),
      http.post(`${API}/auth/refresh`, () => {
        refreshed += 1;
        authorised = true;
        return ok({ user: {} });
      }),
    );
    const [a, b] = await Promise.all([request(api.get('/a')), request(api.get('/b'))]);
    expect(a.data).toEqual({ a: 1 });
    expect(b.data).toEqual({ b: 2 });
    expect(refreshed).toBe(1);
  });

  it('reports an expired session when the refresh fails', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    server.use(
      http.get(`${API}/private`, () => fail(401, 'UNAUTHENTICATED', 'Please log in')),
      http.post(`${API}/auth/refresh`, () => fail(401, 'UNAUTHENTICATED', 'Session ended')),
    );
    await expect(request(api.get('/private'))).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('never tries to refresh after a failed login', async () => {
    let refreshed = false;
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'Wrong')),
      http.post(`${API}/auth/refresh`, () => ((refreshed = true), ok({}))),
    );
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refreshed).toBe(false);
  });

  it('turns field errors into ApiError.fields', async () => {
    server.use(
      http.post(`${API}/thing`, () => fail(422, 'VALIDATION_ERROR', 'Fix it', { fields: { name: 'Too short' } })),
    );
    const err = await api.post('/thing', {}).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.fields).toEqual({ name: 'Too short' });
  });

  it('gives a friendly message when the server cannot be reached', () => {
    const err = toApiError(new Error('Network Error'));
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toMatch(/can't reach the SkillBridge server/i);
  });
});
