import mongoose from 'mongoose';
import {
  REQUEST_MODES,
  REQUEST_STATUS,
  ACTIVE_REQUEST_STATUSES,
  LIMITS,
  LEARNING_LEVEL_VALUES,
} from '@skillbridge/shared';

const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const scoreSchema = new Schema(
  {
    total: Number,
    skill: Number,
    level: Number,
    availability: Number,
    timezone: Number,
    exchange: Number,
  },
  { _id: false },
);

const historySchema = new Schema(
  {
    status: { type: String, enum: Object.values(REQUEST_STATUS), required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ['learner', 'mentor', 'system', 'admin'], required: true },
    note: { type: String, maxlength: 300 },
  },
  { _id: false },
);

/**
 * A learning request ("match request") from a learner to a mentor (SB2/US12–31, 44–46).
 * `active` mirrors "status is queued, pending or accepted" so a partial unique index
 * can stop duplicate active requests between the same people for the same skill (SB2/US24).
 */
const matchRequestSchema = new Schema(
  {
    learner: { type: ObjectId, ref: 'User', required: true },
    mentor: { type: ObjectId, ref: 'User', default: null },
    skill: { type: ObjectId, ref: 'Skill', required: true },
    mode: { type: String, enum: Object.values(REQUEST_MODES), required: true },
    learnerLevel: { type: String, enum: LEARNING_LEVEL_VALUES, default: 'beginner' },
    message: { type: String, trim: true, maxlength: LIMITS.REQUEST_MESSAGE_MAX, default: '' },
    status: { type: String, enum: Object.values(REQUEST_STATUS), default: REQUEST_STATUS.QUEUED },
    active: { type: Boolean, default: true },
    score: { type: scoreSchema, default: null },
    reasons: { type: [String], default: [] },
    sharedMinutes: { type: Number, default: 0 },
    proposedSlot: {
      type: new Schema({ startsAt: Date, endsAt: Date, shared: Boolean }, { _id: false }),
      default: null,
    },
    failure: {
      type: new Schema({ code: String, reason: String, nextStep: String }, { _id: false }),
      default: null,
    },
    declineReason: { type: String, trim: true, maxlength: LIMITS.DECLINE_REASON_MAX, default: '' },
    history: { type: [historySchema], default: [] },
    attempts: { type: Number, default: 1 },
    /** When the mentor first saw it (status became pending). Mentors only see delivered requests. */
    deliveredAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    session: { type: ObjectId, ref: 'Session', default: null },
  },
  { timestamps: true },
);

matchRequestSchema.pre('validate', function syncActive() {
  this.active = ACTIVE_REQUEST_STATUSES.includes(this.status);
  if (this.mentor && String(this.mentor) === String(this.learner)) {
    this.invalidate('mentor', 'You cannot send a request to yourself');
  }
});

matchRequestSchema.index({ learner: 1, status: 1, updatedAt: -1 });
matchRequestSchema.index({ mentor: 1, status: 1, updatedAt: -1 });
matchRequestSchema.index({ status: 1, expiresAt: 1 });
matchRequestSchema.index(
  { learner: 1, mentor: 1, skill: 1 },
  { unique: true, partialFilterExpression: { active: true }, name: 'one_active_request' },
);

export const MatchRequest = mongoose.models.MatchRequest || mongoose.model('MatchRequest', matchRequestSchema);
