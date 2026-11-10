/**
 * Admin review of the skill catalogue (SB2/US47, US42).
 * Admins keep categories tidy and approve or tidy up custom skills that members
 * typed in Sprint 1 (saved as `pending`). Only routes behind authorize('admin') call this.
 */
import mongoose from 'mongoose';
import { ERROR_CODES, SKILL_STATUS, escapeRegex, normalizeSkillName } from '@skillbridge/shared';
import { Category, Skill, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta } from '../utils/respond.js';
import { serializeCategory } from '../utils/serializers.js';

const slugify = (name) =>
  normalizeSkillName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'category';

const nameTaken = (what) =>
  AppError.conflict(ERROR_CODES.NAME_TAKEN, `A ${what} with this name already exists.`, {
    fields: { name: `A ${what} with this name already exists` },
  });

async function categoryStats() {
  const [skills, people] = await Promise.all([
    Skill.aggregate([{ $group: { _id: { category: '$category', status: '$status' }, count: { $sum: 1 } } }]),
    User.aggregate([
      { $unwind: '$teachSkills' },
      { $lookup: { from: 'skills', localField: 'teachSkills.skill', foreignField: '_id', as: 's' } },
      { $unwind: '$s' },
      { $group: { _id: '$s.category', mentors: { $addToSet: '$_id' } } },
    ]),
  ]);
  const stats = new Map();
  const get = (id) => {
    const key = String(id);
    if (!stats.has(key)) stats.set(key, { skillCount: 0, pendingCount: 0, mentorCount: 0 });
    return stats.get(key);
  };
  skills.forEach((r) => {
    const s = get(r._id.category);
    s.skillCount += r.count;
    if (r._id.status === SKILL_STATUS.PENDING) s.pendingCount += r.count;
  });
  people.forEach((r) => {
    get(r._id).mentorCount = r.mentors.length;
  });
  return stats;
}

const adminCategory = (c, stats) => ({
  ...serializeCategory(c),
  isActive: c.isActive,
  order: c.order,
  ...(stats?.get(String(c._id)) ?? { skillCount: 0, pendingCount: 0, mentorCount: 0 }),
});

export async function listCategories() {
  const [categories, stats] = await Promise.all([Category.find().sort({ order: 1, name: 1 }).lean(), categoryStats()]);
  return categories.map((c) => adminCategory(c, stats));
}

async function assertCategoryNameFree(name, exceptId) {
  const clash = await Category.findOne({
    _id: { $ne: exceptId ?? null },
    $or: [{ name: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') }, { slug: slugify(name) }],
  }).lean();
  if (clash) throw nameTaken('category');
}

export async function createCategory(data) {
  await assertCategoryNameFree(data.name);
  const last = await Category.findOne().sort({ order: -1 }).select('order').lean();
  const category = await Category.create({
    icon: 'tag',
    order: (last?.order ?? 0) + 1,
    ...data,
    slug: slugify(data.name),
  });
  return adminCategory(category.toObject(), await categoryStats());
}

export async function updateCategory(id, changes) {
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound('Category not found.');
  if (changes.name && changes.name !== category.name) {
    await assertCategoryNameFree(changes.name, category._id);
    category.slug = slugify(changes.name);
  }
  Object.assign(category, changes);
  await category.save();
  return adminCategory(category.toObject(), await categoryStats());
}

/** Only empty categories can be deleted; otherwise hide them with isActive=false. */
export async function deleteCategory(id) {
  const category = await Category.findById(id);
  if (!category) throw AppError.notFound('Category not found.');
  const inUse = await Skill.countDocuments({ category: category._id });
  if (inUse) {
    throw AppError.conflict(
      ERROR_CODES.CATEGORY_IN_USE,
      `${category.name} still has ${inUse} skill${inUse === 1 ? '' : 's'}. Move them or hide the category instead.`,
    );
  }
  await User.updateMany({ learningInterests: category._id }, { $pull: { learningInterests: category._id } });
  await category.deleteOne();
}

async function usageCounts(skillIds) {
  const ids = skillIds.map((sid) => new mongoose.Types.ObjectId(String(sid)));
  const [teach, learn] = await Promise.all(
    ['teachSkills', 'learnSkills'].map((field) =>
      User.aggregate([
        { $match: { [`${field}.skill`]: { $in: ids } } },
        { $unwind: `$${field}` },
        { $match: { [`${field}.skill`]: { $in: ids } } },
        { $group: { _id: `$${field}.skill`, count: { $sum: 1 } } },
      ]),
    ),
  );
  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.count]));
  return { teach: toMap(teach), learn: toMap(learn) };
}

const adminSkill = (s, usage) => ({
  id: String(s._id),
  name: s.name,
  status: s.status,
  aliases: s.aliases ?? [],
  category: serializeCategory(s.category),
  createdBy: s.createdBy?._id ? { id: String(s.createdBy._id), name: s.createdBy.name } : null,
  teachers: usage?.teach.get(String(s._id)) ?? 0,
  learners: usage?.learn.get(String(s._id)) ?? 0,
  createdAt: s.createdAt,
});

export async function listSkills({ status, q, page, limit }) {
  const filter = { status };
  if (q) filter.normalizedName = new RegExp(escapeRegex(normalizeSkillName(q)), 'i');
  const [skills, total] = await Promise.all([
    Skill.find(filter)
      .sort(status === SKILL_STATUS.PENDING ? { createdAt: 1 } : { name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name slug icon description')
      .populate('createdBy', 'name')
      .lean(),
    Skill.countDocuments(filter),
  ]);
  const usage = await usageCounts(skills.map((s) => s._id));
  return { items: skills.map((s) => adminSkill(s, usage)), meta: pageMeta({ page, limit, total }) };
}

/** Approve, rename, re-categorise or add aliases to a skill (SB2/US47, US42). */
export async function updateSkill(id, { status, name, categoryId, aliases }) {
  const skill = await Skill.findById(id);
  if (!skill) throw AppError.notFound('Skill not found.');
  if (name && normalizeSkillName(name) !== skill.normalizedName) {
    const clash = await Skill.findOne({ _id: { $ne: skill._id }, normalizedName: normalizeSkillName(name) }).lean();
    if (clash) throw nameTaken('skill');
    skill.name = name;
  }
  if (categoryId) {
    const category = await Category.findById(categoryId).lean();
    if (!category) throw AppError.validation({ categoryId: 'Choose an existing category' });
    skill.category = category._id;
  }
  if (aliases) skill.aliases = aliases;
  if (status) skill.status = status;
  try {
    await skill.save();
  } catch (err) {
    if (err?.code === 11000) throw nameTaken('skill');
    throw err;
  }
  await skill.populate([
    { path: 'category', select: 'name slug icon description' },
    { path: 'createdBy', select: 'name' },
  ]);
  const usage = await usageCounts([skill._id]);
  return adminSkill(skill.toObject(), usage);
}
