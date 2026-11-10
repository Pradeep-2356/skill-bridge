import { Link } from 'react-router';
import { Globe2, Clock, ArrowRight, PauseCircle, CalendarCheck } from 'lucide-react';
import { Avatar, SkillChip, Badge } from '../../components/ui/index.js';
import { zoneOffsetLabel, formatMinutes, formatZoneGap } from '../../utils/format.js';
import styles from './MentorCard.module.css';

/**
 * A mentor in discovery results (SB1/US50, SB2/US3–9, US39, US43).
 * Shows only public fields: matched skills with levels, time zone distance,
 * shared weekly time with the viewer, and whether the mentor takes requests.
 */
export function MentorCard({ mentor, footer }) {
  const extraSkills = mentor.teachSkillsCount - mentor.matchedSkills.length - mentor.otherSkills.length;
  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <Avatar name={mentor.name} src={mentor.avatarUrl} size={52} />
        <div className={styles.who}>
          <h3 className={styles.name}>
            <Link to={`/users/${mentor.id}`} className={styles.nameLink}>
              {mentor.name}
            </Link>
          </h3>
          {mentor.headline ? <p className={styles.headline}>{mentor.headline}</p> : null}
        </div>
      </div>
      {mentor.acceptingRequests === false ? (
        <Badge tone="warning" icon={PauseCircle} className={styles.status}>
          Not taking requests right now
        </Badge>
      ) : null}
      <div>
        <p className={styles.label}>Teaches</p>
        <div className={styles.chips}>
          {mentor.matchedSkills.map((s) => (
            <SkillChip key={s.id} kind="teach" name={s.name} level={s.proficiency} />
          ))}
        </div>
        {mentor.otherSkills.length ? (
          <p className={styles.more}>
            Also teaches {mentor.otherSkills.join(', ')}
            {extraSkills > 0 ? ` and ${extraSkills} more` : ''}
          </p>
        ) : null}
      </div>
      <ul role="list" className={styles.facts}>
        <li>
          <Globe2 size={14} aria-hidden="true" />
          <span>
            {mentor.timezone.replace(/_/g, ' ')} ({zoneOffsetLabel(mentor.timezone)})
            {mentor.tzGapHours !== undefined ? (
              <span className={styles.factNote}> · {formatZoneGap(mentor.tzGapHours)}</span>
            ) : null}
          </span>
        </li>
        <li>
          <Clock size={14} aria-hidden="true" />{' '}
          {mentor.availabilitySlots
            ? `${mentor.availabilitySlots} weekly time range${mentor.availabilitySlots === 1 ? '' : 's'}`
            : 'No availability set yet'}
        </li>
        {mentor.sharedMinutes ? (
          <li className={styles.factGood}>
            <CalendarCheck size={14} aria-hidden="true" />
            <span>{formatMinutes(mentor.sharedMinutes)} a week free at the same time as you</span>
          </li>
        ) : null}
      </ul>
      {footer ?? (
        <Link to={`/users/${mentor.id}`} className={styles.cta} aria-label={`View ${mentor.name}'s profile`}>
          View profile <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}
