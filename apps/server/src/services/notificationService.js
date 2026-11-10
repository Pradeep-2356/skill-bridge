/**
 * In-app notifications (SB2/US29). Created by the request and matching services
 * on every lifecycle event and read by the bell in the top bar.
 * Simplified: stored in MongoDB and polled by the client; no WebSockets or push.
 */
import { Notification } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta } from '../utils/respond.js';

export function serializeNotification(n) {
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body ?? '',
    link: n.link ?? null,
    matchRequestId: n.matchRequest ? String(n.matchRequest) : null,
    read: Boolean(n.readAt),
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  };
}

/** Creates one notification. Never throws: a failed notification must not break a request. */
export async function notify(userId, { type, title, body = '', link = null, matchRequest = null }) {
  if (!userId) return null;
  try {
    return await Notification.create({ user: userId, type, title, body, link, matchRequest });
  } catch {
    return null;
  }
}

export const unreadCount = (userId) => Notification.countDocuments({ user: userId, readAt: null });

export async function listNotifications(userId, { unread, page, limit }) {
  const filter = { user: userId, ...(unread ? { readAt: null } : {}) };
  const [items, total, unseen] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    unreadCount(userId),
  ]);
  return {
    items: items.map(serializeNotification),
    meta: { ...pageMeta({ page, limit, total }), unreadCount: unseen },
  };
}

/** Only the owner can mark a notification; anyone else gets 404 so ids cannot be probed. */
export async function markRead(userId, id) {
  const n = await Notification.findOne({ _id: id, user: userId });
  if (!n) throw AppError.notFound('Notification not found.');
  if (!n.readAt) {
    n.readAt = new Date();
    await n.save();
  }
  return serializeNotification(n);
}

export async function markAllRead(userId) {
  const res = await Notification.updateMany({ user: userId, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: res.modifiedCount };
}
