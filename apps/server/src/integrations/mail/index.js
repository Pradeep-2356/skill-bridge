/**
 * Mail adapter. One interface – send({ to, subject, text, html }) – with three
 * local implementations. Next semester an SES adapter can replace "smtp".
 *
 *   smtp    → Mailpit on localhost:1025 (falls back to console if unreachable)
 *   console → prints the email (and its links) in the server terminal
 *   memory  → keeps emails in an array; used by automated tests
 */
import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.js';

function consoleMailer() {
  return {
    kind: 'console',
    async send(message) {
      logger.info(
        `\n──────── EMAIL (console mailer) ────────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n────────────────────────────────────────`,
      );
      return { delivered: 'console' };
    },
  };
}

function memoryMailer() {
  const outbox = [];
  return {
    kind: 'memory',
    outbox,
    async send(message) {
      outbox.push({ ...message, sentAt: new Date() });
      return { delivered: 'memory' };
    },
    latestTo(email) {
      return [...outbox].reverse().find((m) => m.to.toLowerCase() === String(email).toLowerCase()) ?? null;
    },
    clear() {
      outbox.length = 0;
    },
  };
}

function smtpMailer(config) {
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
    ignoreTLS: true,
  });
  const fallback = consoleMailer();
  return {
    kind: 'smtp',
    async send(message) {
      try {
        await transport.sendMail({ from: config.MAIL_FROM, ...message });
        return { delivered: 'smtp' };
      } catch (err) {
        logger.warn(`Mailpit/SMTP not reachable (${err.code ?? err.message}); printing the email instead.`);
        return fallback.send(message);
      }
    },
  };
}

export function createMailer(config) {
  if (config.MAIL_TRANSPORT === 'memory') return memoryMailer();
  if (config.MAIL_TRANSPORT === 'console') return consoleMailer();
  return smtpMailer(config);
}
