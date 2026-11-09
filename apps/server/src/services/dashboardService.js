/** Personalised dashboard data in one request (SB1/US35–38). */
import { SESSION_STATUS } from '@skillbridge/shared';
import { Session } from '../models/Session.js';
import { loadProfile } from './userService.js';
import { listSessions } from './sessionService.js';
import { serializeTeachSkill, serializeLearnSkill } from '../utils/serializers.js';

/** Checklist that drives the profile-completion ring. */
export function profileCompletion(user) {
  const items = [
    { id: 'photo', label: 'Add a profile photo', done: Boolean(user.avatar?.url), link: '/profile/edit' },
    { id: 'headline', label: 'Write a headline', done: Boolean(user.headline?.trim()), link: '/profile/edit' },
    {
      id: 'bio',
      label: 'Write a short bio (20+ characters)',
      done: (user.bio?.trim().length ?? 0) >= 20,
      link: '/profile/edit',
    },
    {
      id: 'interests',
      label: 'Choose learning interests',
      done: (user.learningInterests?.length ?? 0) > 0,
      link: '/profile/edit',
    },
    {
      id: 'teach',
      label: 'Add a skill you can teach',
      done: (user.teachSkills?.length ?? 0) > 0,
      link: '/skills?tab=teach',
    },
    {
      id: 'learn',
      label: 'Add a skill you want to learn',
      done: (user.learnSkills?.length ?? 0) > 0,
      link: '/skills?tab=learn',
    },
    {
      id: 'availability',
      label: 'Set your weekly availability',
      done: (user.availability?.length ?? 0) > 0,
      link: '/availability',
    },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), completed: done, total: items.length, items };
}

export async function getDashboard(userId, now = new Date()) {
  const user = await loadProfile(userId);
  const [upcoming, recent, completedCount] = await Promise.all([
    listSessions(userId, { scope: 'upcoming', page: 1, limit: 3 }, now),
    listSessions(userId, { scope: 'past', page: 1, limit: 5 }, now),
    Session.countDocuments({ $or: [{ learner: userId }, { mentor: userId }], status: SESSION_STATUS.COMPLETED }),
  ]);
  return {
    user: { id: String(user._id), name: user.name, avatarUrl: user.avatar?.url ?? null, timezone: user.timezone },
    profileCompletion: profileCompletion(user),
    skills: {
      teach: user.teachSkills.map(serializeTeachSkill),
      learn: user.learnSkills.map(serializeLearnSkill),
    },
    upcomingSessions: upcoming.items,
    recentActivity: recent.items,
    counts: {
      teachSkills: user.teachSkills.length,
      learnSkills: user.learnSkills.length,
      upcomingSessions: upcoming.meta.total,
      completedSessions: completedCount,
      availabilitySlots: user.availability.length,
    },
  };
}
