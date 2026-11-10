import * as skillService from '../services/skillService.js';
import * as discovery from '../services/discoveryService.js';
import { sendSuccess } from '../utils/respond.js';

export async function listCategories(_req, res) {
  return sendSuccess(res, { categories: await skillService.listCategories() });
}

export async function catalog(req, res) {
  return sendSuccess(res, { skills: await skillService.searchCatalog(req.validated.query, req.user.id) });
}

export async function mySkills(req, res) {
  return sendSuccess(res, await skillService.getMySkills(req.user.id));
}

/** Builds add/update/remove handlers for "teach" or "learn". */
export function forList(kind) {
  return {
    async add(req, res) {
      const entry = await skillService.addSkill(req.user.id, kind, req.validated.body);
      return sendSuccess(res, { entry }, { status: 201 });
    },
    async update(req, res) {
      const entry = await skillService.updateSkill(req.user.id, kind, req.validated.params.entryId, req.validated.body);
      return sendSuccess(res, { entry });
    },
    async remove(req, res) {
      await skillService.removeSkill(req.user.id, kind, req.validated.params.entryId);
      return res.status(204).end();
    },
  };
}

/** SB2/US2, US41 – search-box suggestions. */
export async function suggest(req, res) {
  return sendSuccess(res, { skills: await discovery.suggestSkills(req.validated.query) });
}

/** SB2/US2 – skills related to one skill (same category). */
export async function related(req, res) {
  return sendSuccess(res, { skills: await discovery.relatedSkills(req.validated.params.id) });
}
