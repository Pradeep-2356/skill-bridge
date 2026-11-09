/** Administrator user management (SB1/US47–49). */
import { ACCOUNT_STATUS, DEACTIVATED_BY, ERROR_CODES, escapeRegex } from '@skillbridge/shared';
import { User, Session } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta } from '../utils/respond.js';
import { PROFILE_POPULATE, toAdminUserSummary, toAdminUserDetail } from '../utils/serializers.js';
import { revokeAllRefreshTokens } from './tokenService.js';

export async function listUsers({ q, status, role, page, limit }) {
  const filter = {};
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [users, total, counts] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  return {
    items: users.map(toAdminUserSummary),
    meta: {
      ...pageMeta({ page, limit, total }),
      totals: { active: byStatus.active ?? 0, deactivated: byStatus.deactivated ?? 0 },
    },
  };
}

export async function getUser(id) {
  const user = await User.findById(id).populate(PROFILE_POPULATE).lean();
  if (!user) throw AppError.notFound('User not found.');
  const sessions = await Session.countDocuments({ $or: [{ learner: id }, { mentor: id }] });
  return toAdminUserDetail(user, { sessionsCount: sessions });
}

/** Deactivates or reactivates an account. Deactivation signs the user out everywhere. */
export async function setUserStatus(adminId, targetId, { status, reason }) {
  if (String(adminId) === String(targetId) && status === ACCOUNT_STATUS.DEACTIVATED) {
    throw new AppError(
      400,
      ERROR_CODES.CANNOT_DEACTIVATE_SELF,
      'You cannot deactivate your own account from the admin area.',
    );
  }
  const user = await User.findById(targetId);
  if (!user) throw AppError.notFound('User not found.');

  if (status === ACCOUNT_STATUS.DEACTIVATED) {
    user.status = ACCOUNT_STATUS.DEACTIVATED;
    user.deactivation = { by: DEACTIVATED_BY.ADMIN, reason, byUser: adminId, at: new Date() };
  } else {
    user.status = ACCOUNT_STATUS.ACTIVE;
    user.deactivation = null;
  }
  await user.save();
  if (status === ACCOUNT_STATUS.DEACTIVATED) await revokeAllRefreshTokens(user._id);
  return getUser(targetId);
}
