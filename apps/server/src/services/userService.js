/**
 * Profile, avatar, public profile, deactivation and deletion
 * (SB1/US16–19, 30–34, 46).
 */
import { ACCOUNT_STATUS, DEACTIVATED_BY, ERROR_CODES, ROLES } from '@skillbridge/shared';
import { User, Category, Skill, RefreshToken, PasswordReset, Session } from '../models/index.js';
import { runtime } from '../config/runtime.js';
import { AppError } from '../utils/AppError.js';
import { detectImageType } from '../utils/imageType.js';
import { PROFILE_POPULATE, toPrivateUser, toPublicProfile } from '../utils/serializers.js';
import { verifyPassword } from './passwordService.js';
import { revokeAllRefreshTokens } from './tokenService.js';

export async function loadProfile(userId) {
  const user = await User.findById(userId).populate(PROFILE_POPULATE);
  if (!user) throw AppError.notFound('Account not found.');
  return user;
}

export async function getMe(userId) {
  return toPrivateUser(await loadProfile(userId));
}

/** SB1/US16, 18, 19, 29 */
export async function updateProfile(userId, changes) {
  if (changes.learningInterests) {
    const found = await Category.countDocuments({ _id: { $in: changes.learningInterests }, isActive: true });
    if (found !== changes.learningInterests.length) {
      throw AppError.validation({ learningInterests: 'One or more interests are not available' });
    }
  }
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account not found.');
  Object.assign(user, changes);
  await user.save();
  return getMe(userId);
}

/** SB1/US17 – stores the image via the storage adapter and replaces any old one. */
export async function setAvatar(userId, file) {
  if (!file) throw AppError.validation({ avatar: 'Choose an image to upload' });
  const type = detectImageType(file.buffer);
  if (!type) {
    throw new AppError(415, ERROR_CODES.UNSUPPORTED_FILE_TYPE, 'That file is not a valid JPEG, PNG or WebP image.');
  }
  const { storage } = runtime();
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account not found.');

  const saved = await storage.save(file.buffer, { folder: 'avatars', ext: type.ext });
  const oldKey = user.avatar?.key;
  user.avatar = { key: saved.key, url: saved.url, updatedAt: new Date() };
  await user.save();
  if (oldKey) await storage.remove(oldKey);
  return { avatarUrl: saved.url };
}

export async function removeAvatar(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account not found.');
  if (user.avatar?.key) await runtime().storage.remove(user.avatar.key);
  user.avatar = null;
  await user.save();
  return { avatarUrl: null };
}

/** SB1/US46, SB1/US30 – another user's profile, public fields only. */
export async function getPublicProfile(targetId) {
  const user = await User.findOne({ _id: targetId, status: ACCOUNT_STATUS.ACTIVE }).populate(PROFILE_POPULATE);
  if (!user) throw AppError.notFound('This profile is not available.');
  return toPublicProfile(user);
}

/** SB1/US31 – my profile exactly as others see it. */
export async function getPreview(userId) {
  return toPublicProfile(await loadProfile(userId));
}

async function confirmPassword(userId, password) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw AppError.unauthenticated();
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw AppError.validation({ password: 'Your password is incorrect' });
  }
  return user;
}

async function assertNotLastAdmin(user) {
  if (user.role !== ROLES.ADMIN) return;
  const admins = await User.countDocuments({ role: ROLES.ADMIN, status: ACCOUNT_STATUS.ACTIVE });
  if (admins <= 1) {
    throw AppError.conflict(
      ERROR_CODES.LAST_ADMIN,
      'You are the only active administrator, so this account cannot be removed.',
    );
  }
}

/** SB1/US32 – the user can come back later by logging in. */
export async function deactivateSelf(userId, password) {
  const user = await confirmPassword(userId, password);
  await assertNotLastAdmin(user);
  user.status = ACCOUNT_STATUS.DEACTIVATED;
  user.deactivation = { by: DEACTIVATED_BY.SELF, at: new Date() };
  await user.save();
  await revokeAllRefreshTokens(user._id);
}

/**
 * SB1/US33, US34 – permanent removal. Sessions are kept for the other participant
 * and show "Former member"; custom skills stay in the catalogue without an owner.
 */
export async function deleteAccount(userId, password) {
  const user = await confirmPassword(userId, password);
  await assertNotLastAdmin(user);
  if (user.avatar?.key) await runtime().storage.remove(user.avatar.key);
  await Promise.all([
    RefreshToken.deleteMany({ user: user._id }),
    PasswordReset.deleteMany({ user: user._id }),
    Session.updateMany({ learner: user._id }, { $set: { learner: null } }),
    Session.updateMany({ mentor: user._id }, { $set: { mentor: null } }),
    Skill.updateMany({ createdBy: user._id }, { $set: { createdBy: null } }),
  ]);
  await User.deleteOne({ _id: user._id });
}
