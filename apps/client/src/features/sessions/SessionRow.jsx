import { Link } from 'react-router';
import { Avatar, Badge } from '../../components/ui/index.js';
import { formatTime } from '../../utils/format.js';
import styles from './SessionRow.module.css';

const STATUS = {
  scheduled: { tone: 'pending', label: 'Scheduled' },
  completed: { tone: 'success', label: 'Completed' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

/** One session: date block, skill, partner, role and status (SB1/US37, US38). */
export function SessionRow({ session, timezone, compact = false }) {
  const start = new Date(session.startsAt);
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: timezone }).format(start);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: timezone }).format(start);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: timezone }).format(start);
  const status = STATUS[session.status] ?? STATUS.scheduled;
  const teaching = session.role === 'mentor';
  return (
    <li className={`${styles.row} ${compact ? styles.compact : ''}`}>
      <div className={styles.date} aria-hidden="true">
        <span className={styles.month}>{month}</span>
        <span className={styles.day}>{day}</span>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>
          {session.skill?.name ?? 'Session'}
          <span className="sr-only">
            , {weekday} {day} {month}
          </span>
        </p>
        <p className={styles.meta}>
          {weekday} · {formatTime(session.startsAt, timezone)}–{formatTime(session.endsAt, timezone)} ·{' '}
          {session.durationMinutes} min
        </p>
        <div className={styles.partner}>
          {session.partner ? (
            <>
              <Avatar name={session.partner.name} src={session.partner.avatarUrl} size={22} />
              <span>
                {teaching ? 'Teaching ' : 'Learning with '}
                <Link to={`/users/${session.partner.id}`}>{session.partner.name}</Link>
              </span>
            </>
          ) : (
            <span className="text-muted">With a former member</span>
          )}
        </div>
      </div>
      <div className={styles.badges}>
        <Badge tone={teaching ? 'teach' : 'learn'}>{teaching ? 'You teach' : 'You learn'}</Badge>
        {!compact ? <Badge tone={status.tone}>{status.label}</Badge> : null}
        {session.source === 'demo' ? <Badge tone="neutral">Demo</Badge> : null}
      </div>
    </li>
  );
}
