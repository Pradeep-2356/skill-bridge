/**
 * Keyword skill search (SB1/US50).
 * Matches skill names and aliases, case-insensitively and literally (regex
 * characters are escaped), then returns active mentors who teach those skills.
 * Sprint 2 replaces this with a MongoDB text index, filters and relevance.
 */
import { ACCOUNT_STATUS, escapeRegex, normalizeSkillName } from '@skillbridge/shared';
import { Skill, User } from '../models/index.js';
import { pageMeta } from '../utils/respond.js';

export async function searchMentors(viewerId, { q, page, limit }) {
  const pattern = new RegExp(escapeRegex(normalizeSkillName(q)), 'i');
  const skills = await Skill.find({ $or: [{ normalizedName: pattern }, { aliases: pattern }] })
    .select('_id name')
    .lean();
  const skillIds = skills.map((s) => s._id);
  const matched = new Set(skillIds.map(String));

  const filter = {
    _id: { $ne: viewerId },
    status: ACCOUNT_STATUS.ACTIVE,
    'teachSkills.skill': { $in: skillIds },
  };
  const [users, total] = await Promise.all([
    skillIds.length
      ? User.find(filter)
          .sort({ name: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('teachSkills.skill', 'name')
          .lean()
      : [],
    skillIds.length ? User.countDocuments(filter) : 0,
  ]);

  const items = users.map((u) => {
    const matchedSkills = u.teachSkills
      .filter((t) => t.skill && matched.has(String(t.skill._id)))
      .map((t) => ({ id: String(t.skill._id), name: t.skill.name, proficiency: t.proficiency }));
    return {
      id: String(u._id),
      name: u.name,
      headline: u.headline ?? '',
      avatarUrl: u.avatar?.url ?? null,
      timezone: u.timezone,
      matchedSkills,
      otherSkills: u.teachSkills
        .filter((t) => t.skill && !matched.has(String(t.skill._id)))
        .slice(0, 3)
        .map((t) => t.skill.name),
      teachSkillsCount: u.teachSkills.length,
      availabilitySlots: u.availability?.length ?? 0,
    };
  });

  return { items, meta: { ...pageMeta({ page, limit, total }), query: q } };
}
