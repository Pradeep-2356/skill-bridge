/**
 * Turns database documents into API responses.
 * `toPublicProfile` is the ONLY way another user's data leaves the API, so
 * private fields (email, role, status, login times) can never leak (SB1/US31, US46).
 */
import { sortSlots } from '@skillbridge/shared';

const id = (doc) => (doc ? String(doc._id ?? doc.id ?? doc) : null);

export function serializeCategory(cat) {
  if (!cat || !cat._id) return null;
  return { id: id(cat), name: cat.name, slug: cat.slug, icon: cat.icon, description: cat.description ?? '' };
}

export function serializeSkill(skill) {
  if (!skill || !skill._id) return null;
  return {
    id: id(skill),
    name: skill.name,
    status: skill.status,
    category: serializeCategory(skill.category),
  };
}

export function serializeTeachSkill(entry) {
  return {
    id: id(entry),
    skill: serializeSkill(entry.skill),
    proficiency: entry.proficiency,
    yearsExperience: entry.yearsExperience ?? null,
    description: entry.description ?? '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function serializeLearnSkill(entry) {
  return {
    id: id(entry),
    skill: serializeSkill(entry.skill),
    preferredLevel: entry.preferredLevel,
    goal: entry.goal ?? '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

const slots = (user) => sortSlots((user.availability ?? []).map(({ day, start, end }) => ({ day, start, end })));

/** What another signed-in user may see. */
export function toPublicProfile(user) {
  return {
    id: id(user),
    name: user.name,
    headline: user.headline ?? '',
    bio: user.bio ?? '',
    avatarUrl: user.avatar?.url ?? null,
    timezone: user.timezone,
    learningInterests: (user.learningInterests ?? []).map(serializeCategory).filter(Boolean),
    teachSkills: (user.teachSkills ?? []).map(serializeTeachSkill),
    learnSkills: (user.learnSkills ?? []).map(serializeLearnSkill),
    availability: slots(user),
    memberSince: user.createdAt,
  };
}

/** What the account owner sees about themselves. */
export function toPrivateUser(user) {
  return {
    ...toPublicProfile(user),
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
    acceptingRequests: user.acceptingRequests !== false,
  };
}

/** Minimal person card used in session lists and search results. */
export function toPersonCard(user) {
  if (!user || !user._id) return null;
  return { id: id(user), name: user.name, headline: user.headline ?? '', avatarUrl: user.avatar?.url ?? null };
}

/** Admin list row (SB1/US47). Never includes the password hash. */
export function toAdminUserSummary(user) {
  return {
    id: id(user),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatar?.url ?? null,
    teachSkillsCount: user.teachSkills?.length ?? 0,
    learnSkillsCount: user.learnSkills?.length ?? 0,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

/** Admin detail view (SB1/US49). */
export function toAdminUserDetail(user, extra = {}) {
  return {
    ...toAdminUserSummary(user),
    headline: user.headline ?? '',
    bio: user.bio ?? '',
    timezone: user.timezone,
    updatedAt: user.updatedAt,
    deactivation: user.deactivation
      ? { by: user.deactivation.by, reason: user.deactivation.reason ?? '', at: user.deactivation.at }
      : null,
    teachSkills: (user.teachSkills ?? []).map(serializeTeachSkill),
    learnSkills: (user.learnSkills ?? []).map(serializeLearnSkill),
    availabilitySlots: user.availability?.length ?? 0,
    ...extra,
  };
}

/** Populate options so skills arrive with their category. */
export const PROFILE_POPULATE = [
  {
    path: 'teachSkills.skill',
    select: 'name status category',
    populate: { path: 'category', select: 'name slug icon description' },
  },
  {
    path: 'learnSkills.skill',
    select: 'name status category',
    populate: { path: 'category', select: 'name slug icon description' },
  },
  { path: 'learningInterests', select: 'name slug icon description' },
];
