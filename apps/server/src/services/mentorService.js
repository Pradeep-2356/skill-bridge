/**
 * Mentor profile for discovery (SB2/US8–11, US30, US43).
 * Builds on the Sprint 1 public profile (toPublicProfile – still the only way
 * another member's data leaves the API) and adds what a learner needs to decide:
 * availability in both time zones, shared free time, skill-exchange hints and
 * any open request between the two people.
 */
import {
  ACCOUNT_STATUS,
  SLOT_HORIZON_DAYS,
  SLOT_LEAD_HOURS,
  convertSlots,
  intersectIntervals,
  intervalsToSlots,
  nextSlotIn,
  slotsToUtcIntervals,
  timeZoneGapHours,
  totalIntervalMinutes,
} from '@skillbridge/shared';
import { MatchRequest, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { PROFILE_POPULATE, toPublicProfile, serializeSkill } from '../utils/serializers.js';

const ids = (entries) => new Set(entries.map((e) => String(e.skill?._id ?? e.skill)));

export async function getMentorProfile(viewerId, mentorId, now = new Date()) {
  const [mentor, viewer] = await Promise.all([
    User.findOne({ _id: mentorId, status: ACCOUNT_STATUS.ACTIVE }).populate(PROFILE_POPULATE),
    User.findById(viewerId).select('timezone availability teachSkills learnSkills').lean(),
  ]);
  if (!mentor) throw AppError.notFound('This profile is not available.');
  const isSelf = String(mentor._id) === String(viewerId);

  const viewerTz = viewer?.timezone ?? 'UTC';
  const mentorSlots = (mentor.availability ?? []).map(({ day, start, end }) => ({ day, start, end }));
  const mentorIntervals = slotsToUtcIntervals(mentorSlots, mentor.timezone, now);
  const shared = intersectIntervals(slotsToUtcIntervals(viewer?.availability ?? [], viewerTz, now), mentorIntervals);
  const opts = { now, leadHours: SLOT_LEAD_HOURS, horizonDays: SLOT_HORIZON_DAYS };

  // Skill exchange hints (SB2/US9, US10): what each person can offer the other.
  const viewerLearns = ids(viewer?.learnSkills ?? []);
  const viewerTeaches = ids(viewer?.teachSkills ?? []);
  const theyCanTeachYou = mentor.teachSkills
    .filter((t) => t.skill && viewerLearns.has(String(t.skill._id)))
    .map((t) => ({ skill: serializeSkill(t.skill), proficiency: t.proficiency }));
  const youCanTeachThem = mentor.learnSkills
    .filter((l) => l.skill && viewerTeaches.has(String(l.skill._id)))
    .map((l) => ({ skill: serializeSkill(l.skill), preferredLevel: l.preferredLevel }));

  const openRequests = isSelf
    ? []
    : await MatchRequest.find({ learner: viewerId, mentor: mentor._id, active: true })
        .select('skill status')
        .populate('skill', 'name')
        .lean();

  return {
    profile: { ...toPublicProfile(mentor), acceptingRequests: mentor.acceptingRequests !== false },
    isSelf,
    availability: {
      mentorTimezone: mentor.timezone,
      viewerTimezone: viewerTz,
      tzGapHours: timeZoneGapHours(viewerTz, mentor.timezone, now),
      inMentorZone: mentorSlots,
      inViewerZone: convertSlots(mentorSlots, mentor.timezone, viewerTz, now),
      sharedInViewerZone: intervalsToSlots(shared, viewerTz, now),
      sharedMinutes: totalIntervalMinutes(shared),
      nextSharedSlot: nextSlotIn(shared, opts),
      nextMentorSlot: nextSlotIn(mentorIntervals, opts),
    },
    exchange: { theyCanTeachYou, youCanTeachThem },
    openRequests: openRequests.map((r) => ({
      id: String(r._id),
      status: r.status,
      skill: r.skill ? { id: String(r.skill._id), name: r.skill.name } : null,
    })),
  };
}

/** SB2/US43 – a mentor pauses or resumes new learning requests. */
export async function setAcceptingRequests(userId, acceptingRequests) {
  const user = await User.findByIdAndUpdate(userId, { $set: { acceptingRequests } }, { returnDocument: 'after' })
    .select('acceptingRequests')
    .lean();
  if (!user) throw AppError.notFound('Account not found.');
  return { acceptingRequests: user.acceptingRequests !== false };
}
