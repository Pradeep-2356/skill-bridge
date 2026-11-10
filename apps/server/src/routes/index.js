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
  skillSuggestQuerySchema,
  sessionsQuerySchema,
  adminUserQuerySchema,
  adminStatusSchema,
  objectIdSchema,
  ROLES,
  acceptingRequestsSchema,
  matchRequestCreateSchema,
  matchRequestListQuerySchema,
  declineRequestSchema,
  matchSuggestionsQuerySchema,
  notificationsQuerySchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  adminSkillQuerySchema,
  adminSkillUpdateSchema,
} from '@skillbridge/shared';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import { avatarUpload } from '../middleware/upload.js';
import * as auth from '../controllers/authController.js';
import * as users from '../controllers/userController.js';
import * as skills from '../controllers/skillController.js';
import * as misc from '../controllers/miscControllers.js';
import * as s2 from '../controllers/sprint2Controllers.js';

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
  secured.patch('/users/me/accepting-requests', validate({ body: acceptingRequestsSchema }), s2.mentors.setAccepting); // SB2/US43

  // skills (SB1/US19–26, 36)
  const teach = skills.forList('teach');
  const learn = skills.forList('learn');
  secured.get('/categories', skills.listCategories);
  secured.get('/skills', validate({ query: skillCatalogQuerySchema }), skills.catalog);
  secured.get('/skills/suggest', validate({ query: skillSuggestQuerySchema }), skills.suggest); // SB2/US2, 41
  secured.get('/skills/:id/related', validate({ params: idParam }), skills.related); // SB2/US2
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

  // mentor profiles (SB2/US8–11, 30)
  secured.get('/mentors/:id', validate({ params: idParam }), s2.mentors.get);

  // learning requests (SB2/US12–16, 23–28, 30, 31, 44, 45) – ownership is checked in the service
  secured.post('/match-requests', validate({ body: matchRequestCreateSchema }), s2.requests.create);
  secured.get('/match-requests', validate({ query: matchRequestListQuerySchema }), s2.requests.list);
  secured.get('/match-requests/:id', validate({ params: idParam }), s2.requests.get);
  secured.patch('/match-requests/:id/accept', validate({ params: idParam }), s2.requests.accept);
  secured.patch(
    '/match-requests/:id/decline',
    validate({ params: idParam, body: declineRequestSchema }),
    s2.requests.decline,
  );
  secured.patch('/match-requests/:id/cancel', validate({ params: idParam }), s2.requests.cancel);
  secured.post('/match-requests/:id/retry', validate({ params: idParam }), s2.requests.retry);

  // match suggestions (SB2/US17–24, 42, 43, 46)
  secured.get('/matches/suggestions', validate({ query: matchSuggestionsQuerySchema }), s2.suggestions);

  // notifications (SB2/US29)
  secured.get('/notifications', validate({ query: notificationsQuerySchema }), s2.notifications.list);
  secured.get('/notifications/unread-count', s2.notifications.unreadCount);
  secured.post('/notifications/read-all', s2.notifications.markAllRead);
  secured.patch('/notifications/:id/read', validate({ params: idParam }), s2.notifications.markRead);

  // admin (SB1/US47–49)
  const adminRouter = Router();
  adminRouter.use(authorize(ROLES.ADMIN));
  adminRouter.get('/users', validate({ query: adminUserQuerySchema }), misc.admin.listUsers);
  adminRouter.get('/users/:id', validate({ params: idParam }), misc.admin.getUser);
  adminRouter.patch('/users/:id/status', validate({ params: idParam, body: adminStatusSchema }), misc.admin.setStatus);
  // admin catalogue review (SB2/US47)
  adminRouter.get('/categories', s2.adminCatalog.listCategories);
  adminRouter.post('/categories', validate({ body: categoryCreateSchema }), s2.adminCatalog.createCategory);
  adminRouter.patch(
    '/categories/:id',
    validate({ params: idParam, body: categoryUpdateSchema }),
    s2.adminCatalog.updateCategory,
  );
  adminRouter.delete('/categories/:id', validate({ params: idParam }), s2.adminCatalog.deleteCategory);
  adminRouter.get('/skills', validate({ query: adminSkillQuerySchema }), s2.adminCatalog.listSkills);
  adminRouter.patch(
    '/skills/:id',
    validate({ params: idParam, body: adminSkillUpdateSchema }),
    s2.adminCatalog.updateSkill,
  );
  secured.use('/admin', adminRouter);

  api.use(secured);
  return api;
}
