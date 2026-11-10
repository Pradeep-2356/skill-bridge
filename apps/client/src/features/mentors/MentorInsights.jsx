import { useState } from 'react';
import { Link } from 'react-router';
import { Repeat2, CalendarCheck, Clock } from 'lucide-react';
import { Card, SkillChip, EmptyState, Badge } from '../../components/ui/index.js';
import { WeeklyBars } from '../availability/WeeklyBars.jsx';
import { formatDateTime, formatMinutes, formatZoneGap, summariseSlots } from '../../utils/format.js';
import styles from './Mentors.module.css';

/** What each person could teach the other (SB2/US9, US10, US18). */
export function ExchangeCard({ exchange, mentorName }) {
  const { theyCanTeachYou, youCanTeachThem } = exchange;
  if (!theyCanTeachYou.length && !youCanTeachThem.length) return null;
  return (
    <Card title="Why this could work" subtitle="Skills you could exchange">
      <div className={styles.exchange}>
        {theyCanTeachYou.length ? (
          <div>
            <p className={styles.exchangeLabel}>{mentorName} can teach you</p>
            <div className={styles.chips}>
              {theyCanTeachYou.map((e) => (
                <SkillChip key={e.skill.id} kind="teach" name={e.skill.name} level={e.proficiency} />
              ))}
            </div>
          </div>
        ) : null}
        {youCanTeachThem.length ? (
          <div>
            <p className={styles.exchangeLabel}>
              <Repeat2 size={14} aria-hidden="true" /> You can teach {mentorName}
            </p>
            <div className={styles.chips}>
              {youCanTeachThem.map((e) => (
                <SkillChip key={e.skill.id} kind="learn" name={e.skill.name} level={e.preferredLevel} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * The mentor's weekly time slots shown in YOUR time zone or theirs, with the
 * times you are both free and the next possible session (SB2/US11, US21, US31).
 */
export function AvailabilityCompare({ availability, mentorName }) {
  const [zone, setZone] = useState('viewer');
  const { viewerTimezone, mentorTimezone, tzGapHours, sharedMinutes, sharedInViewerZone, nextSharedSlot } =
    availability;
  const showViewer = zone === 'viewer';
  const slots = showViewer ? availability.inViewerZone : availability.inMentorZone;
  const tz = showViewer ? viewerTimezone : mentorTimezone;
  const sameZone = viewerTimezone === mentorTimezone || tzGapHours === 0;

  return (
    <Card
      title="Availability"
      subtitle={formatZoneGap(tzGapHours)}
      action={
        sameZone ? null : (
          <div className={styles.zoneSwitch} role="group" aria-label="Show times in">
            <button type="button" aria-pressed={showViewer} onClick={() => setZone('viewer')}>
              Your time
            </button>
            <button type="button" aria-pressed={!showViewer} onClick={() => setZone('mentor')}>
              {mentorName.split(' ')[0]}’s time
            </button>
          </div>
        )
      }
    >
      {slots.length ? (
        <WeeklyBars slots={slots} timezone={tz} />
      ) : (
        <EmptyState compact icon={Clock} title="No availability yet" />
      )}
      <div className={styles.shared}>
        {sharedMinutes ? (
          <>
            <Badge tone="success" icon={CalendarCheck}>
              {formatMinutes(sharedMinutes)} a week in common
            </Badge>
            <ul role="list" className={styles.sharedList} aria-label="Times you are both free (your time)">
              {summariseSlots(sharedInViewerZone).map((d) => (
                <li key={d.day}>
                  <strong>{d.label}</strong> {d.ranges.join(', ')}
                </li>
              ))}
            </ul>
            {nextSharedSlot ? (
              <p className={styles.next}>
                Next shared slot: <strong>{formatDateTime(nextSharedSlot.startsAt, viewerTimezone)}</strong> (your time)
              </p>
            ) : null}
          </>
        ) : slots.length ? (
          <p className={styles.noShared}>
            You are not free at the same time yet. <Link to="/availability">Update your availability</Link> to find
            shared time.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
