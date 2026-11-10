/** Sprint 2 controllers: mentor profiles, learning requests, matches, notifications, admin catalogue. */
import * as mentorService from '../services/mentorService.js';
import * as requestService from '../services/requestService.js';
import * as notificationService from '../services/notificationService.js';
import * as catalogAdmin from '../services/catalogAdminService.js';
import { getSuggestions } from '../services/matching/matchingService.js';
import { sendSuccess } from '../utils/respond.js';

export const mentors = {
  async get(req, res) {
    return sendSuccess(res, await mentorService.getMentorProfile(req.user.id, req.validated.params.id));
  },
  async setAccepting(req, res) {
    return sendSuccess(
      res,
      await mentorService.setAcceptingRequests(req.user.id, req.validated.body.acceptingRequests),
    );
  },
};

export const requests = {
  async create(req, res) {
    const request = await requestService.createRequest(req.user.id, req.validated.body);
    return sendSuccess(res, { request }, { status: 202 });
  },
  async list(req, res) {
    const { items, meta } = await requestService.listRequests(req.user.id, req.validated.query);
    return sendSuccess(res, { requests: items }, { meta });
  },
  async get(req, res) {
    return sendSuccess(res, {
      request: await requestService.getRequest(req.user.id, req.user.role, req.validated.params.id),
    });
  },
  async accept(req, res) {
    return sendSuccess(res, await requestService.acceptRequest(req.user.id, req.validated.params.id));
  },
  async decline(req, res) {
    const request = await requestService.declineRequest(req.user.id, req.validated.params.id, req.validated.body);
    return sendSuccess(res, { request });
  },
  async cancel(req, res) {
    return sendSuccess(res, { request: await requestService.cancelRequest(req.user.id, req.validated.params.id) });
  },
  async retry(req, res) {
    const request = await requestService.retryRequest(req.user.id, req.validated.params.id);
    return sendSuccess(res, { request }, { status: 202 });
  },
};

export async function suggestions(req, res) {
  return sendSuccess(res, await getSuggestions(req.user.id, req.validated.query));
}

export const notifications = {
  async list(req, res) {
    const { items, meta } = await notificationService.listNotifications(req.user.id, req.validated.query);
    return sendSuccess(res, { notifications: items }, { meta });
  },
  async unreadCount(req, res) {
    return sendSuccess(res, { unreadCount: await notificationService.unreadCount(req.user.id) });
  },
  async markRead(req, res) {
    return sendSuccess(res, { notification: await notificationService.markRead(req.user.id, req.validated.params.id) });
  },
  async markAllRead(req, res) {
    return sendSuccess(res, await notificationService.markAllRead(req.user.id));
  },
};

export const adminCatalog = {
  async listCategories(_req, res) {
    return sendSuccess(res, { categories: await catalogAdmin.listCategories() });
  },
  async createCategory(req, res) {
    return sendSuccess(res, { category: await catalogAdmin.createCategory(req.validated.body) }, { status: 201 });
  },
  async updateCategory(req, res) {
    return sendSuccess(res, {
      category: await catalogAdmin.updateCategory(req.validated.params.id, req.validated.body),
    });
  },
  async deleteCategory(req, res) {
    await catalogAdmin.deleteCategory(req.validated.params.id);
    return res.status(204).end();
  },
  async listSkills(req, res) {
    const { items, meta } = await catalogAdmin.listSkills(req.validated.query);
    return sendSuccess(res, { skills: items }, { meta });
  },
  async updateSkill(req, res) {
    return sendSuccess(res, { skill: await catalogAdmin.updateSkill(req.validated.params.id, req.validated.body) });
  },
};
