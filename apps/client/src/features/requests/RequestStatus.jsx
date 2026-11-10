import { Hourglass, Clock, CheckCircle2, XCircle, Ban, TimerOff, AlertTriangle } from 'lucide-react';
import { Badge } from '../../components/ui/index.js';
import { formatDateTime, relativeTime } from '../../utils/format.js';
import styles from './Requests.module.css';

/** Label, colour and icon for each request status (SB2/US25–28). */
export const STATUS_META = {
  queued: { label: 'Being matched', tone: 'neutral', icon: Hourglass },
  pending: { label: 'Waiting for reply', tone: 'pending', icon: Clock },
  accepted: { label: 'Accepted', tone: 'success', icon: CheckCircle2 },
  declined: { label: 'Declined', tone: 'danger', icon: XCircle },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  expired: { label: 'Expired', tone: 'warning', icon: TimerOff },
  failed: { label: 'No match', tone: 'danger', icon: AlertTriangle },
};

export const statusLabel = (status) => STATUS_META[status]?.label ?? status;

export function StatusBadge({ status, label }) {
  const meta = STATUS_META[status] ?? STATUS_META.queued;
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {label ?? meta.label}
    </Badge>
  );
}

/** What happened, in words, for each (status, who) pair in the history. */
export function eventLabel(h, index) {
  const key = `${h.status}:${h.by}`;
  const labels = {
    'queued:learner': index === 0 ? 'Request sent' : 'Sent again',
    'pending:system': 'Delivered to the mentor',
    'accepted:mentor': 'Accepted by the mentor',
    'declined:mentor': 'Declined by the mentor',
    'cancelled:learner': 'Cancelled by the learner',
    'cancelled:system': 'Closed by SkillBridge',
    'expired:system': 'Expired after 7 days without a reply',
    'failed:system': 'No match found',
  };
  return labels[key] ?? STATUS_META[h.status]?.label ?? h.status;
}

/** Every status change, oldest first (SB2/US25). */
export function StatusTimeline({ history, timezone }) {
  return (
    <ol className={styles.timeline} aria-label="Status history">
      {history.map((h, i) => {
        const meta = STATUS_META[h.status] ?? STATUS_META.queued;
        const Icon = meta.icon;
        return (
          <li key={`${h.status}-${i}`} className={`${styles.timelineItem} ${styles[`tone-${meta.tone}`]}`}>
            <span className={styles.timelineDot}>
              <Icon size={14} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.timelineTitle}>{eventLabel(h, i)}</p>
              <p className={styles.timelineTime} title={formatDateTime(h.at, timezone)}>
                {relativeTime(h.at)}
                {h.note ? ` · ${h.note}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
