import { Link } from 'react-router';
import { Globe2, Clock, ArrowRight } from 'lucide-react';
import { Avatar, SkillChip } from '../../components/ui/index.js';
import { zoneOffsetLabel } from '../../utils/format.js';
import styles from './MentorCard.module.css';

/** A mentor in search results (SB1/US50). Only public fields are shown. */
export function MentorCard({ mentor }) {
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
            {mentor.teachSkillsCount > mentor.matchedSkills.length + mentor.otherSkills.length
              ? ` and ${mentor.teachSkillsCount - mentor.matchedSkills.length - mentor.otherSkills.length} more`
              : ''}
          </p>
        ) : null}
      </div>
      <ul role="list" className={styles.facts}>
        <li>
          <Globe2 size={14} aria-hidden="true" /> {mentor.timezone.replace(/_/g, ' ')} (
          {zoneOffsetLabel(mentor.timezone)})
        </li>
        <li>
          <Clock size={14} aria-hidden="true" />{' '}
          {mentor.availabilitySlots
            ? `${mentor.availabilitySlots} weekly time range${mentor.availabilitySlots === 1 ? '' : 's'}`
            : 'No availability set yet'}
        </li>
      </ul>
      <Link to={`/users/${mentor.id}`} className={styles.cta} aria-label={`View ${mentor.name}'s profile`}>
        View profile <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}
