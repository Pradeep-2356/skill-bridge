/**
 * Local message queue backed by MongoDB (SB2/US48, US49 – simplified).
 *
 * Same contract as the Amazon SQS adapter planned for next semester:
 *   send(queue, body)                → id
 *   receive(queue, { max })          → [{ id, body, receiveCount }]  (hidden for the visibility timeout)
 *   remove(id)                       → deletes a processed message
 *   release(id, error)               → records the error; the message reappears after the timeout
 * A message received more than `maxReceives` times is marked `dead` instead of being returned.
 * Nothing here needs AWS credentials or a network connection.
 */
import { QueueMessage } from '../../models/index.js';

export function createLocalQueue({ visibilitySeconds = 30, maxReceives = 3, onDead } = {}) {
  return {
    kind: 'local-mongo',

    async send(queue, body) {
      const message = await QueueMessage.create({ queue, body, visibleAt: new Date() });
      return String(message._id);
    },

    async receive(queue, { max = 5, now = new Date() } = {}) {
      const received = [];
      while (received.length < max) {
        // Atomically claim one visible message and hide it (like SQS ReceiveMessage).
        const message = await QueueMessage.findOneAndUpdate(
          { queue, status: 'ready', visibleAt: { $lte: now } },
          { $inc: { receiveCount: 1 }, $set: { visibleAt: new Date(now.getTime() + visibilitySeconds * 1000) } },
          { sort: { visibleAt: 1, _id: 1 }, returnDocument: 'after' },
        ).lean();
        if (!message) break;
        if (message.receiveCount > maxReceives) {
          await QueueMessage.updateOne({ _id: message._id }, { $set: { status: 'dead' } });
          if (onDead)
            await onDead({ id: String(message._id), queue, body: message.body, lastError: message.lastError });
          continue;
        }
        received.push({ id: String(message._id), body: message.body, receiveCount: message.receiveCount });
      }
      return received;
    },

    async remove(id) {
      await QueueMessage.deleteOne({ _id: id });
    },

    async release(id, error, { retryAfterSeconds = 0, now = new Date() } = {}) {
      await QueueMessage.updateOne(
        { _id: id },
        {
          $set: {
            lastError: String(error?.message ?? error),
            visibleAt: new Date(now.getTime() + retryAfterSeconds * 1000),
          },
        },
      );
    },

    async stats(queue) {
      const [ready, dead] = await Promise.all([
        QueueMessage.countDocuments({ queue, status: 'ready' }),
        QueueMessage.countDocuments({ queue, status: 'dead' }),
      ]);
      return { ready, dead };
    },
  };
}
