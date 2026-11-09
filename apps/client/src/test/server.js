/**
 * MSW mock API for component tests. Each test adds the handlers it needs with
 * server.use(...). Unhandled requests fail the test, so nothing slips through.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = '*/api/v1';
export const server = setupServer();

export const ok = (data, meta) => HttpResponse.json({ success: true, data, ...(meta ? { meta } : {}) });
export const fail = (status, code, message, extra = {}) =>
  HttpResponse.json({ success: false, error: { code, message, ...extra } }, { status });

export { http, HttpResponse };
