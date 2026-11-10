import {
  Bell,
  Inbox,
  CheckCircle2,
  XCircle,
  Ban,
  TimerOff,
  Sparkles,
  HeartHandshake,
  AlertTriangle,
} from 'lucide-react';
import { relativeTime } from '../../utils/format.js';
import styles from './Notifications.module.css';

const ICONS = {
  request_received: Inbox,
  request_accepted: CheckCircle2,
  request_declined: XCircle,
  request_cancelled: Ban,
  request_expired: TimerOff,
  match_found: Sparkles,
  match_confirmed: HeartHandshake,
  match_failed: AlertTriangle,
};
const TONES = {
  request_accepted: 'success',
  match_confirmed: 'success',
  request_declined: 'danger',
  match_failed: 'warning',
  request_expired: 'warning',
};

/** One notification row, used in the bell menu and on the notifications page. */
export function NotificationItem({ notification: n, onOpen, compact = false, children }) {
  const Icon = ICONS[n.type] ?? Bell;
  return (
    <div className={`${styles.item} ${n.read ? '' : styles.unread} ${compact ? styles.compactItem : ''}`}>
      <span className={`${styles.icon} ${styles[`tone-${TONES[n.type] ?? 'primary'}`]}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <button type="button" className={styles.itemButton} onClick={() => onOpen(n)}>
        <span className={styles.itemTitle}>
          {n.read ? null : <span className="sr-only">Unread: </span>}
          {n.title}
        </span>
        {n.body && !compact ? <span className={styles.itemBody}>{n.body}</span> : null}
        <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
      </button>
      {n.read ? null : <span className={styles.dot} aria-hidden="true" />}
      {children}
    </div>
  );
}
