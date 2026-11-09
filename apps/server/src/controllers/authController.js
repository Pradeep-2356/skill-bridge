import * as authService from '../services/authService.js';
import { getMe } from '../services/userService.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE } from '../services/tokenService.js';
import { sendSuccess } from '../utils/respond.js';

const userAgent = (req) => req.get('user-agent') ?? '';

async function signIn(req, res, user, status = 200) {
  const tokens = await authService.startSession(user, { userAgent: userAgent(req) });
  setAuthCookies(res, tokens);
  return sendSuccess(res, { user: await getMe(user._id) }, { status });
}

export async function register(req, res) {
  const user = await authService.register(req.validated.body);
  return signIn(req, res, user, 201);
}

export async function login(req, res) {
  const user = await authService.login(req.validated.body);
  return signIn(req, res, user);
}

export async function refresh(req, res) {
  try {
    const { user, accessToken, refreshToken } = await authService.refreshSession(req.cookies?.[REFRESH_COOKIE], {
      userAgent: userAgent(req),
    });
    setAuthCookies(res, { accessToken, refreshToken });
    return sendSuccess(res, { user: await getMe(user._id) });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.[REFRESH_COOKIE]);
  clearAuthCookies(res);
  return res.status(204).end();
}

export async function me(req, res) {
  return sendSuccess(res, { user: await getMe(req.user.id) });
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.validated.body.email);
  return sendSuccess(
    res,
    { message: 'If an account exists for that email, a reset link is on its way. Check your inbox.' },
    { status: 202 },
  );
}

export async function resetPassword(req, res) {
  await authService.resetPassword(req.validated.body);
  clearAuthCookies(res);
  return sendSuccess(res, { message: 'Your password has been updated. You can now log in.' });
}

export async function changePassword(req, res) {
  const user = await authService.changePassword(req.user.id, req.validated.body);
  // Every other device was signed out; this browser gets a fresh session.
  const tokens = await authService.startSession(user, { userAgent: userAgent(req) });
  setAuthCookies(res, tokens);
  return sendSuccess(res, { message: 'Password changed. Other devices have been signed out.' });
}
