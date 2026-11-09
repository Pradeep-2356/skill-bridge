/**
 * Skill catalogue and the user's teach/learn lists (SB1/US19–26, 36).
 */
import { ERROR_CODES, LIMITS, SKILL_STATUS, escapeRegex, normalizeSkillName } from '@skillbridge/shared';
import { User, Skill, Category } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import {
  PROFILE_POPULATE,
  serializeCategory,
  serializeSkill,
  serializeTeachSkill,
  serializeLearnSkill,
} from '../utils/serializers.js';

const LISTS = {
  teach: { field: 'teachSkills', max: LIMITS.MAX_TEACH_SKILLS, serialize: serializeTeachSkill, label: 'teach' },
  learn: { field: 'learnSkills', max: LIMITS.MAX_LEARN_SKILLS, serialize: serializeLearnSkill, label: 'learn' },
};

export async function listCategories() {
  const categories = await Category.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
  return categories.map(serializeCategory);
}

/** Catalogue lookup for the skill picker: approved skills + the caller's own pending ones. */
export async function searchCatalog({ q, category, limit }, userId) {
  const filter = { $or: [{ status: SKILL_STATUS.APPROVED }, { createdBy: userId }] };
  if (category) filter.category = category;
  if (q) {
    const pattern = new RegExp(escapeRegex(normalizeSkillName(q)), 'i');
    filter.$and = [{ $or: [{ normalizedName: pattern }, { aliases: pattern }] }];
  }
  const skills = await Skill.find(filter)
    .populate('category', 'name slug icon description')
    .sort({ name: 1 })
    .limit(limit)
    .lean();
  // Names that start with the query first, then the rest alphabetically.
  if (q) {
    const n = normalizeSkillName(q);
    skills.sort((a, b) => Number(!a.normalizedName.startsWith(n)) - Number(!b.normalizedName.startsWith(n)));
  }
  return skills.map(serializeSkill);
}

/** Finds the catalogue skill, or creates a pending custom one (SB1/US20, 22). */
async function resolveSkill({ skillId, customName, categoryId }, userId) {
  if (skillId) {
    const skill = await Skill.findOne({
      _id: skillId,
      $or: [{ status: SKILL_STATUS.APPROVED }, { createdBy: userId }],
    });
    if (!skill) throw AppError.validation({ skillId: 'That skill is not in the catalogue' });
    return skill;
  }
  const normalized = normalizeSkillName(customName);
  const existing = await Skill.findOne({ $or: [{ normalizedName: normalized }, { aliases: normalized }] });
  if (existing) return existing;

  const category = await Category.findOne({ _id: categoryId, isActive: true });
  if (!category) throw AppError.validation({ categoryId: 'Choose an available category' });
  return Skill.create({
    name: customName.trim(),
    category: category._id,
    status: SKILL_STATUS.PENDING,
    createdBy: userId,
  });
}

async function loadUserWithSkills(userId) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('Account not found.');
  return user;
}

async function serializeEntry(userId, kind, entryId) {
  const user = await User.findById(userId).populate(PROFILE_POPULATE);
  const entry = user[LISTS[kind].field].id(entryId);
  return LISTS[kind].serialize(entry);
}

export async function getMySkills(userId) {
  const user = await User.findById(userId).populate(PROFILE_POPULATE);
  if (!user) throw AppError.notFound('Account not found.');
  return {
    teachSkills: user.teachSkills.map(serializeTeachSkill),
    learnSkills: user.learnSkills.map(serializeLearnSkill),
  };
}

/** Adds a teach or learn skill (SB1/US20–22, 25, 26). */
export async function addSkill(userId, kind, data) {
  const list = LISTS[kind];
  const user = await loadUserWithSkills(userId);
  if (user[list.field].length >= list.max) {
    throw AppError.validation({ _form: `You can list up to ${list.max} skills to ${list.label}. Remove one first.` });
  }
  const skill = await resolveSkill(data, userId);
  if (user[list.field].some((e) => String(e.skill) === String(skill._id))) {
    throw AppError.conflict(ERROR_CODES.SKILL_ALREADY_ADDED, `${skill.name} is already in your list.`, {
      fields: { skillId: `${skill.name} is already in your list` },
    });
  }
  const { skillId: _s, customName: _c, categoryId: _cat, ...details } = data;
  user[list.field].push({ skill: skill._id, ...details });
  await user.save();
  const entry = user[list.field].at(-1);
  return serializeEntry(userId, kind, entry._id);
}

/** SB1/US24, 25, 26 */
export async function updateSkill(userId, kind, entryId, changes) {
  const list = LISTS[kind];
  const user = await loadUserWithSkills(userId);
  const entry = user[list.field].id(entryId);
  if (!entry) throw AppError.notFound('That skill is not in your list.');
  Object.assign(entry, changes);
  await user.save();
  return serializeEntry(userId, kind, entryId);
}

/** SB1/US23 */
export async function removeSkill(userId, kind, entryId) {
  const list = LISTS[kind];
  const user = await loadUserWithSkills(userId);
  const entry = user[list.field].id(entryId);
  if (!entry) throw AppError.notFound('That skill is not in your list.');
  entry.deleteOne();
  await user.save();
}

export { serializeSkill };
