import mongoose from 'mongoose';
import {
  ROLES,
  ACCOUNT_STATUS,
  DEACTIVATED_BY,
  PROFICIENCY_VALUES,
  LEARNING_LEVEL_VALUES,
  LIMITS,
} from '@skillbridge/shared';

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

/** A skill the user can teach (SB1/US20, 21, 24, 25). */
const teachSkillSchema = new Schema(
  {
    skill: { type: ObjectId, ref: 'Skill', required: true },
    proficiency: { type: String, enum: PROFICIENCY_VALUES, required: true },
    yearsExperience: { type: Number, min: 0, max: LIMITS.YEARS_EXPERIENCE_MAX },
    description: { type: String, trim: true, maxlength: LIMITS.SKILL_DESCRIPTION_MAX, default: '' },
  },
  { timestamps: true },
);

/** A skill the user wants to learn (SB1/US22, 24, 26). */
const learnSkillSchema = new Schema(
  {
    skill: { type: ObjectId, ref: 'Skill', required: true },
    preferredLevel: { type: String, enum: LEARNING_LEVEL_VALUES, required: true },
    goal: { type: String, trim: true, maxlength: LIMITS.LEARNING_GOAL_MAX, default: '' },
  },
  { timestamps: true },
);

/** One weekly time range in the user's own time zone (SB1/US27, 28). */
const availabilitySlotSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, required: true, match: /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/ },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: LIMITS.EMAIL_MAX,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    status: { type: String, enum: Object.values(ACCOUNT_STATUS), default: ACCOUNT_STATUS.ACTIVE },
    deactivation: {
      type: new Schema(
        {
          by: { type: String, enum: Object.values(DEACTIVATED_BY), required: true },
          reason: { type: String, trim: true, maxlength: LIMITS.DEACTIVATION_REASON_MAX },
          byUser: { type: ObjectId, ref: 'User' },
          at: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: null,
    },
    name: { type: String, required: true, trim: true, minlength: LIMITS.NAME_MIN, maxlength: LIMITS.NAME_MAX },
    headline: { type: String, trim: true, maxlength: LIMITS.HEADLINE_MAX, default: '' },
    bio: { type: String, trim: true, maxlength: LIMITS.BIO_MAX, default: '' },
    avatar: {
      type: new Schema({ key: String, url: String, updatedAt: Date }, { _id: false }),
      default: null,
    },
    timezone: { type: String, default: 'UTC' },
    learningInterests: [{ type: ObjectId, ref: 'Category' }],
    teachSkills: { type: [teachSkillSchema], default: [] },
    learnSkills: { type: [learnSkillSchema], default: [] },
    availability: { type: [availabilitySlotSchema], default: [] },
    /** SB2/US43 – mentors can pause new learning requests. Missing on Sprint 1 data = true. */
    acceptingRequests: { type: Boolean, default: true },
    /** Bumped on password change/reset so older access tokens stop working. */
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ 'teachSkills.skill': 1, status: 1 });
userSchema.index({ status: 1, createdAt: -1 });

userSchema.virtual('isActive').get(function isActive() {
  return this.status === ACCOUNT_STATUS.ACTIVE;
});

export const User = mongoose.models.User || mongoose.model('User', userSchema);
