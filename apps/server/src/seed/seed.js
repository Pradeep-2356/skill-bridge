/**
 * Idempotent seed: adds anything that is missing, never deletes.
 * Used by `npm run db:seed`, `npm run db:reset` and the Playwright test setup.
 */
import bcrypt from 'bcryptjs';
import {
  ROLES,
  ACCOUNT_STATUS,
  DEACTIVATED_BY,
  SESSION_SOURCE,
  SESSION_STATUS,
  SKILL_STATUS,
  REQUEST_MODES,
  REQUEST_STATUS,
  normalizeSkillName,
} from '@skillbridge/shared';
import { Category, Skill, User, Session, MatchRequest } from '../models/index.js';
import { processRequest } from '../services/matching/matchingService.js';
import { acceptRequest, declineRequest } from '../services/requestService.js';
import { CATEGORIES, SKILLS, PEOPLE, DEMO_DOMAIN, patternFor } from './data.js';

const DAY = 86_400_000;

/** Today at the given UTC hour/minute, shifted by `days`. */
function utcAt(days, hour, minute = 0, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  return new Date(d.getTime() + days * DAY);
}

export async function seedDatabase({ password = 'Demo@1234', bcryptCost = 10, log = () => {}, now = new Date() } = {}) {
  const summary = { categories: 0, skills: 0, users: 0, sessions: 0, requests: 0 };

  // 1. Categories
  const categoryBySlug = {};
  for (const [order, c] of CATEGORIES.entries()) {
    let doc = await Category.findOne({ slug: c.slug });
    if (!doc) {
      doc = await Category.create({ ...c, order });
      summary.categories += 1;
    }
    categoryBySlug[c.slug] = doc;
  }

  // 2. Skill catalogue
  const skillByName = {};
  for (const [name, slug, aliases, description] of SKILLS) {
    let doc = await Skill.findOne({ normalizedName: normalizeSkillName(name) });
    if (!doc) {
      doc = await Skill.create({ name, aliases, description, category: categoryBySlug[slug]._id });
      summary.skills += 1;
    }
    skillByName[name] = doc;
  }

  // 3. People (one shared hash keeps seeding fast)
  const passwordHash = await bcrypt.hash(password, bcryptCost);
  const userByKey = {};

  const admin = await User.findOne({ email: `admin@${DEMO_DOMAIN}` });
  if (!admin) {
    userByKey.admin = await User.create({
      name: 'Asha Admin',
      email: `admin@${DEMO_DOMAIN}`,
      passwordHash,
      role: ROLES.ADMIN,
      timezone: 'Asia/Kolkata',
      headline: 'SkillBridge administrator',
    });
    summary.users += 1;
  } else {
    userByKey.admin = admin;
  }

  for (const [index, person] of PEOPLE.entries()) {
    const [key, name, timezone, headline, bio, teach, learn, interestSlugs, patternIndex, extra = {}] = person;
    const email = `${key}@${DEMO_DOMAIN}`;
    let doc = await User.findOne({ email });
    if (!doc) {
      doc = await User.create({
        name,
        email,
        passwordHash,
        timezone,
        headline,
        bio,
        learningInterests: interestSlugs.map((s) => categoryBySlug[s]._id),
        teachSkills: teach.map(([skill, proficiency, yearsExperience]) => ({
          skill: skillByName[skill]._id,
          proficiency,
          yearsExperience,
          description: '',
        })),
        learnSkills: learn.map(([skill, preferredLevel]) => ({
          skill: skillByName[skill]._id,
          preferredLevel,
          goal: '',
        })),
        availability: patternFor(patternIndex ?? index),
        lastLoginAt: new Date(now.getTime() - (index % 7) * DAY),
        ...(extra.deactivated
          ? {
              status: ACCOUNT_STATUS.DEACTIVATED,
              deactivation: {
                by: DEACTIVATED_BY.ADMIN,
                reason: extra.deactivated,
                byUser: userByKey.admin._id,
                at: now,
              },
            }
          : {}),
      });
      summary.users += 1;
    }
    userByKey[key] = doc;
  }

  // 4. Demo sessions for the two demo accounts (only once)
  const demoCount = await Session.countDocuments({ source: SESSION_SOURCE.DEMO });
  if (demoCount === 0) {
    const s = (learner, mentor, skill, startsAt, status = SESSION_STATUS.SCHEDULED) => ({
      learner: userByKey[learner]._id,
      mentor: userByKey[mentor]._id,
      skill: skillByName[skill]._id,
      startsAt,
      status,
      source: SESSION_SOURCE.DEMO,
    });
    const rows = [
      s('arjun', 'priya', 'React', utcAt(2, 13, 0, now)), // 18:30 IST
      s('priya', 'arjun', 'Python', utcAt(4, 13, 30, now)), // 19:00 IST
      s('arjun', 'oliver', 'Public Speaking', utcAt(6, 17, 0, now)), // 18:00 London (winter)
      s('arjun', 'priya', 'React', utcAt(-5, 13, 0, now), SESSION_STATUS.COMPLETED),
      s('isla', 'priya', 'JavaScript', utcAt(-9, 12, 0, now), SESSION_STATUS.COMPLETED),
      s('arjun', 'lucas', 'Data Analysis', utcAt(-3, 16, 0, now), SESSION_STATUS.CANCELLED),
      s('priya', 'oliver', 'Public Speaking', utcAt(-12, 11, 0, now), SESSION_STATUS.COMPLETED),
    ];
    // Lucas teaches Statistics/Python/ML; use a skill he teaches for realism.
    rows[5].skill = skillByName['Machine Learning']._id;
    await Session.insertMany(rows);
    summary.sessions = rows.length;
  }

  // 5. Sprint 2 demo data (only once): a paused mentor, a custom skill to review,
  //    and learning requests created through the real matching and request services.
  await User.updateOne(
    { email: `mia@${DEMO_DOMAIN}`, acceptingRequests: { $ne: false } },
    { $set: { acceptingRequests: false } },
  );
  if (!(await Skill.exists({ normalizedName: 'svelte kit' }))) {
    const custom = await Skill.create({
      name: 'Svelte Kit',
      category: skillByName.React.category,
      status: SKILL_STATUS.PENDING,
      createdBy: userByKey.aarav._id,
    });
    await User.updateOne(
      { _id: userByKey.aarav._id },
      { $push: { teachSkills: { skill: custom._id, proficiency: 'intermediate' } } },
    );
  }
  if ((await MatchRequest.countDocuments()) === 0) {
    const make = async (learner, mentor, skill, message) => {
      const request = await MatchRequest.create({
        learner: userByKey[learner]._id,
        mentor: userByKey[mentor]._id,
        skill: skillByName[skill]._id,
        mode: REQUEST_MODES.DIRECT,
        message,
        status: REQUEST_STATUS.QUEUED,
        history: [{ status: REQUEST_STATUS.QUEUED, by: 'learner', at: new Date(now.getTime() - 3600_000) }],
      });
      await processRequest(request._id, now);
      summary.requests += 1;
      return request._id;
    };
    // Waiting for Priya (mentor journey).
    await make('meera', 'priya', 'React', 'Hi Priya! I know HTML and CSS and want to start React with small projects.');
    await make(
      'isla',
      'priya',
      'UI Design',
      'Could you review my portfolio layouts and teach me the basics of spacing?',
    );
    // Arjun's history (learner view): one accepted with a real session, one declined.
    const accepted = await make('arjun', 'oliver', 'Public Speaking', 'I freeze in team meetings – can we practise?');
    await acceptRequest(userByKey.oliver._id, accepted, now);
    const declined = await make('arjun', 'meera', 'Indian Cooking', 'Would love to learn a weekday dal.');
    await declineRequest(userByKey.meera._id, declined, { reason: 'I am travelling for the next two weeks.' }, now);
  }

  log(
    `Seed complete: +${summary.categories} categories, +${summary.skills} skills, +${summary.users} users, +${summary.sessions} demo sessions, +${summary.requests} learning requests.`,
  );
  return summary;
}
