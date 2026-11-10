/**
 * Background worker for the local matching queue and the expiry job
 * (SB2/US44, US49, US50 – simplified: runs inside the API process instead of AWS Lambda).
 *
 * - drain(): receives queued messages and calls processRequest for each. A message
 *   that throws is released and retried after a short delay; after QUEUE_MAX_RECEIVES
 *   failed attempts the queue marks it dead and the request becomes `failed`.
 * - kick(): asks for an immediate drain (used right after a request is created).
 * - start()/stop(): timers for drain (every MATCH_WORKER_INTERVAL_MS) and expiry
 *   (every EXPIRY_JOB_INTERVAL_MS). Tests never start the timers; they call drain() directly.
 */
import { logger } from '../utils/logger.js';

export function createMatchWorker({
  queue,
  queueName,
  processMessage,
  expire,
  intervalMs = 1000,
  expiryIntervalMs = 60000,
}) {
  let timers = [];
  let running = null;
  let started = false;

  async function drainOnce(now) {
    let processed = 0;
    for (;;) {
      const batch = await queue.receive(queueName, { max: 5, now: now ?? new Date() });
      if (!batch.length) return processed;
      for (const message of batch) {
        try {
          await processMessage(message.body, now ?? new Date());
          await queue.remove(message.id);
        } catch (err) {
          logger.warn?.(`Matching attempt ${message.receiveCount} failed: ${err.message}`);
          await queue.release(message.id, err, {
            retryAfterSeconds: now ? 0 : 2 * message.receiveCount,
            now: now ?? new Date(),
          });
        }
        processed += 1;
      }
    }
  }

  /** Processes everything that is visible now. Never runs two drains at once. */
  async function drain({ now } = {}) {
    if (running) await running;
    running = drainOnce(now).finally(() => {
      running = null;
    });
    return running;
  }

  return {
    drain,
    kick() {
      if (started) setImmediate(() => drain().catch((err) => logger.error(err)));
    },
    start() {
      if (started) return;
      started = true;
      if (intervalMs > 0) timers.push(setInterval(() => drain().catch((err) => logger.error(err)), intervalMs));
      if (expiryIntervalMs > 0)
        timers.push(setInterval(() => expire().catch((err) => logger.error(err)), expiryIntervalMs));
      timers.forEach((t) => t.unref?.());
    },
    stop() {
      timers.forEach(clearInterval);
      timers = [];
      started = false;
    },
    get started() {
      return started;
    },
  };
}
