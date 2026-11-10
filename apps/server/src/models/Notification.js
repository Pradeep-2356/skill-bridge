import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '@skillbridge/shared';

/**
 * In-app notification (SB2/US29). Stored in MongoDB and fetched by the client
 * every 30 seconds – a simplified stand-in for real-time push, which is deferred.
 */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: null },
    matchRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'MatchRequest', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
