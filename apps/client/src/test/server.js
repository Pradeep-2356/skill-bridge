/**
 * MSW mock API for component tests. Each test adds the handlers it needs with
 * server.use(...). Unhandled requests fail the test, so nothing slips through.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = '*/api/v1';
/**
 * Requests every signed-in page makes in the background (notification badge,
 * category list for filters). Tests override them with server.use(...) when needed.
 */
const defaults = [
  http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ success: true, data: { unreadCount: 0 } })),
  http.get('*/api/v1/categories', () => HttpResponse.json({ success: true, data: { categories: [] } })),
  http.get('*/api/v1/skills/suggest', () => HttpResponse.json({ success: true, data: { skills: [] } })),
];

export const server = setupServer(...defaults);

export const ok = (data, meta) => HttpResponse.json({ success: true, data, ...(meta ? { meta } : {}) });
export const fail = (status, code, message, extra = {}) =>
  HttpResponse.json({ success: false, error: { code, message, ...extra } }, { status });

export { http, HttpResponse };
