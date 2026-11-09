import mongoose from 'mongoose';
import { SESSION_STATUS, SESSION_SOURCE, SESSION_DURATION_MINUTES } from '@skillbridge/shared';

const { ObjectId } = mongoose.Schema.Types;

/**
 * A 30-minute learning session. In Sprint 1 these are seeded demo rows
 * (`source: 'demo'`); Sprint 2 creates real ones when a request is accepted.
 */
const sessionSchema = new mongoose.Schema(
  {
    learner: { type: ObjectId, ref: 'User', default: null },
    mentor: { type: ObjectId, ref: 'User', default: null },
    skill: { type: ObjectId, ref: 'Skill', required: true },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: SESSION_DURATION_MINUTES },
    status: { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.SCHEDULED },
    source: { type: String, enum: Object.values(SESSION_SOURCE), default: SESSION_SOURCE.DEMO },
    matchRequest: { type: ObjectId, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ learner: 1, startsAt: 1 });
sessionSchema.index({ mentor: 1, startsAt: 1 });

sessionSchema.pre('validate', function differentPeople() {
  if (this.learner && this.mentor && String(this.learner) === String(this.mentor)) {
    this.invalidate('mentor', 'Learner and mentor must be different people');
  }
});

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
