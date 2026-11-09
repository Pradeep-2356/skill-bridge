import * as skillService from '../services/skillService.js';
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
