import * as userService from '../services/userService.js';
import { clearAuthCookies } from '../services/tokenService.js';
import { sendSuccess } from '../utils/respond.js';

export async function getMe(req, res) {
  return sendSuccess(res, { user: await userService.getMe(req.user.id) });
}

export async function updateMe(req, res) {
  return sendSuccess(res, { user: await userService.updateProfile(req.user.id, req.validated.body) });
}

export async function uploadAvatar(req, res) {
  return sendSuccess(res, await userService.setAvatar(req.user.id, req.file));
}

export async function deleteAvatar(req, res) {
  return sendSuccess(res, await userService.removeAvatar(req.user.id));
}

export async function preview(req, res) {
  return sendSuccess(res, { profile: await userService.getPreview(req.user.id) });
}

export async function getPublicProfile(req, res) {
  return sendSuccess(res, { profile: await userService.getPublicProfile(req.validated.params.id) });
}

export async function deactivate(req, res) {
  await userService.deactivateSelf(req.user.id, req.validated.body.password);
  clearAuthCookies(res);
  return sendSuccess(res, { message: 'Your account has been deactivated. Log in again any time to reactivate it.' });
}

export async function deleteMe(req, res) {
  await userService.deleteAccount(req.user.id, req.validated.body.password);
  clearAuthCookies(res);
  return res.status(204).end();
}
