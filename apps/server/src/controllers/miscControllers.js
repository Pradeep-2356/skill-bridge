/** Small read-mostly controllers: availability, dashboard, sessions, search, admin, health. */
import { getAvailability, replaceAvailability } from '../services/availabilityService.js';
import { getDashboard } from '../services/dashboardService.js';
import { listSessions } from '../services/sessionService.js';
import { searchMentors } from '../services/searchService.js';
import * as adminService from '../services/adminService.js';
import { databaseStatus } from '../config/db.js';
import { sendSuccess } from '../utils/respond.js';

export const availability = {
  async get(req, res) {
    return sendSuccess(res, await getAvailability(req.user.id));
  },
  async put(req, res) {
    return sendSuccess(res, await replaceAvailability(req.user.id, req.validated.body));
  },
};

export async function dashboard(req, res) {
  return sendSuccess(res, await getDashboard(req.user.id));
}

export async function sessions(req, res) {
  const { items, meta } = await listSessions(req.user.id, req.validated.query);
  return sendSuccess(res, { sessions: items }, { meta });
}

export async function searchMentorsHandler(req, res) {
  const { items, meta } = await searchMentors(req.user.id, req.validated.query);
  return sendSuccess(res, { mentors: items }, { meta });
}

export const admin = {
  async listUsers(req, res) {
    const { items, meta } = await adminService.listUsers(req.validated.query);
    return sendSuccess(res, { users: items }, { meta });
  },
  async getUser(req, res) {
    return sendSuccess(res, { user: await adminService.getUser(req.validated.params.id) });
  },
  async setStatus(req, res) {
    const user = await adminService.setUserStatus(req.user.id, req.validated.params.id, req.validated.body);
    return sendSuccess(res, { user });
  },
};

export function health(_req, res) {
  const db = databaseStatus();
  return res.status(db === 'up' ? 200 : 503).json({
    success: db === 'up',
    data: { status: db === 'up' ? 'ok' : 'degraded', db, uptimeSeconds: Math.round(process.uptime()) },
  });
}
