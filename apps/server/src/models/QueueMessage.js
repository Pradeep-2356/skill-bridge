import mongoose from 'mongoose';

/**
 * A message in the local work queue (SB2/US48, US49). It copies the Amazon SQS
 * behaviour the project will use next semester: a received message is hidden
 * for a visibility timeout, and after too many failed receives it is moved to a
 * "dead" state (dead-letter). Stored in MongoDB so queued work survives a restart.
 */
const queueMessageSchema = new mongoose.Schema(
  {
    queue: { type: String, required: true },
    body: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['ready', 'dead'], default: 'ready' },
    visibleAt: { type: Date, default: Date.now },
    receiveCount: { type: Number, default: 0 },
    lastError: { type: String, default: null },
  },
  { timestamps: true },
);

queueMessageSchema.index({ queue: 1, status: 1, visibleAt: 1 });

export const QueueMessage = mongoose.models.QueueMessage || mongoose.model('QueueMessage', queueMessageSchema);
