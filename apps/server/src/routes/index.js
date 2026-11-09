/**
 * All /api/v1 routes. Each line reads: method, path, guards, validation, controller.
 * Protected routers apply `authenticate` once at the top, so no endpoint can forget it.
 */
import { Router } from 'express';
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileUpdateSchema,
  teachSkillCreateSchema,
  teachSkillUpdateSchema,
  learnSkillCreateSchema,
  learnSkillUpdateSchema,
  skillCatalogQuerySchema,
  availabilitySchema,
  deactivateAccountSchema,
  deleteAccountSchema,
  mentorSearchQuerySchema,
  sessionsQuerySchema,
  adminUserQuerySchema,
  adminStatusSchema,
  objectIdSchema,
  ROLES,
} from '@skillbridge/shared';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { avatarUpload } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as skills from '../controllers/skillController.js';
import * as misc from '../controllers/miscControllers.js';

const idParam = z.object({ id: objectIdSchema });
const entryParam = z.object({ entryId: objectIdSchema });

export function buildApiRouter(config) {
  const api = Router();

  // ── public ──
  api.get('/health', misc.health);

  // ── auth (SB1/US1–15) ──
  const authRouter = Router();
  authRouter.post('/register', validate({ body: registerSchema }), auth.register);
  authRouter.post('/login', validate({ body: loginSchema }), auth.login);
  authRouter.post('/refresh', auth.refresh);
  authRouter.post('/logout', auth.logout);
  authRouter.post('/forgot-password', validate({ body: forgotPasswordSchema }), auth.forgotPassword);
  authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), auth.resetPassword);
  authRouter.get('/me', authenticate, auth.me);
  authRouter.patch('/password', authenticate, validate({ body: changePasswordSchema }), auth.changePassword);
  api.use('/auth', authRouter);

  // ── everything below needs a logged-in user (SB1/US13) ──
  const secured = Router();
  secured.use(authenticate);

  // profile (SB1/US16–19, 30–34, 46)
  secured.get('/users/me', users.getMe);
  secured.patch('/users/me', validate({ body: profileUpdateSchema }), users.updateMe);
  secured.put('/users/me/avatar', avatarUpload(config.MAX_AVATAR_MB), users.uploadAvatar);
  secured.delete('/users/me/avatar', users.deleteAvatar);
  secured.get('/users/me/preview', users.preview);
  secured.post('/users/me/deactivate', validate({ body: deactivateAccountSchema }), users.deactivate);
  secured.delete('/users/me', validate({ body: deleteAccountSchema }), users.deleteMe);

  // skills (SB1/US19–26, 36)
  const teach = skills.forList('teach');
  const learn = skills.forList('learn');
  secured.get('/categories', skills.listCategories);
  secured.get('/skills', validate({ query: skillCatalogQuerySchema }), skills.catalog);
  secured.get('/users/me/skills', skills.mySkills);
  secured.post('/users/me/teach-skills', validate({ body: teachSkillCreateSchema }), teach.add);
  secured.patch(
    '/users/me/teach-skills/:entryId',
    validate({ params: entryParam, body: teachSkillUpdateSchema }),
    teach.update,
  );
  secured.delete('/users/me/teach-skills/:entryId', validate({ params: entryParam }), teach.remove);
  secured.post('/users/me/learn-skills', validate({ body: learnSkillCreateSchema }), learn.add);
  secured.patch(
    '/users/me/learn-skills/:entryId',
    validate({ params: entryParam, body: learnSkillUpdateSchema }),
    learn.update,
  );
  secured.delete('/users/me/learn-skills/:entryId', validate({ params: entryParam }), learn.remove);

  // availability (SB1/US27–29)
  secured.get('/users/me/availability', misc.availability.get);
  secured.put('/users/me/availability', validate({ body: availabilitySchema }), misc.availability.put);

  // public profile of another user – after the /users/me routes so "me" is not read as an id
  secured.get('/users/:id', validate({ params: idParam }), users.getPublicProfile);

  // dashboard, sessions, search (SB1/US35–39, 50)
  secured.get('/dashboard', misc.dashboard);
  secured.get('/sessions', validate({ query: sessionsQuerySchema }), misc.sessions);
  secured.get('/search/mentors', validate({ query: mentorSearchQuerySchema }), misc.searchMentorsHandler);

  // admin (SB1/US47–49)
  const adminRouter = Router();
  adminRouter.use(authorize(ROLES.ADMIN));
  adminRouter.get('/users', validate({ query: adminUserQuerySchema }), misc.admin.listUsers);
  adminRouter.get('/users/:id', validate({ params: idParam }), misc.admin.getUser);
  adminRouter.patch('/users/:id/status', validate({ params: idParam, body: adminStatusSchema }), misc.admin.setStatus);
  secured.use('/admin', adminRouter);

  api.use(secured);
  return api;
}
