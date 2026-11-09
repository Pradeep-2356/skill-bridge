import { Link } from 'react-router';
import {
  Sparkles,
  GraduationCap,
  CalendarClock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Search,
  Plus,
  Clock,
  UserRound,
  History,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  StatCard,
  ProgressRing,
  SkillChip,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
} from '../components/ui/index.js';
import { SessionRow } from '../features/sessions/SessionRow.jsx';
import { dashboardApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';
import { greeting } from '../utils/format.js';
import page from './Page.module.css';
import styles from './DashboardPage.module.css';

function DashboardSkeleton() {
  return (
    <div className={page.stack} aria-busy="true" aria-label="Loading your dashboard">
      <div className={styles.topGrid}>
        <Skeleton height={190} radius="var(--radius-lg)" />
        <div className={styles.stats}>
          <Skeleton height={88} radius="var(--radius-lg)" count={3} gap={16} />
        </div>
      </div>
      <div className={page.grid2}>
        <Skeleton height={240} radius="var(--radius-lg)" />
        <Skeleton height={240} radius="var(--radius-lg)" />
      </div>
    </div>
  );
}

/** SB1/US35 (personalised dashboard), US36 (skills), US37 (upcoming sessions), US38 (recent activity), US39 (navigation). */
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => dashboardApi.get(), []);
  const tz = user.timezone;
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <PageHeader
        title={`${greeting(tz)}, ${firstName}`}
        subtitle="Here’s what’s next for you on SkillBridge."
        actions={
          <Button leftIcon={Search} to="/search">
            Find a mentor
          </Button>
        }
      />
      {loading ? <DashboardSkeleton /> : null}
      {error ? <ErrorState title="We couldn’t load your dashboard" message={error.message} onRetry={reload} /> : null}
      {data ? (
        <div className={page.stack}>
          <div className={styles.topGrid}>
            <Card
              title="Profile strength"
              subtitle={
                data.profileCompletion.percent === 100
                  ? 'Your profile is complete. Nice work!'
                  : 'A complete profile gets you better matches.'
              }
            >
              <div className={styles.completion}>
                <ProgressRing
                  percent={data.profileCompletion.percent}
                  size={96}
                  stroke={9}
                  label={`Profile ${data.profileCompletion.percent}% complete`}
                />
                <ul role="list" className={styles.checklist}>
                  {data.profileCompletion.items.map((item) => (
                    <li key={item.id} className={item.done ? styles.done : ''}>
                      {item.done ? (
                        <CheckCircle2 size={16} aria-hidden="true" />
                      ) : (
                        <Circle size={16} aria-hidden="true" />
                      )}
                      {item.done ? (
                        <span>
                          {item.label}
                          <span className="sr-only"> – done</span>
                        </span>
                      ) : (
                        <Link to={item.link}>{item.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
            <div className={styles.stats}>
              <StatCard
                icon={Sparkles}
                tone="teach"
                label="Skills you teach"
                value={data.counts.teachSkills}
                to="/skills?tab=teach"
                hint="Manage teaching skills"
              />
              <StatCard
                icon={GraduationCap}
                tone="learn"
                label="Skills you’re learning"
                value={data.counts.learnSkills}
                to="/skills?tab=learn"
                hint="Manage learning goals"
              />
              <StatCard
                icon={CalendarClock}
                label="Upcoming sessions"
                value={data.counts.upcomingSessions}
                to="/sessions"
                hint={`${data.counts.completedSessions} completed so far`}
              />
            </div>
          </div>

          <div className={page.grid2}>
            <Card
              title="Upcoming sessions"
              action={
                <Link to="/sessions" className={page.linkRow}>
                  View all <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.upcomingSessions.length === 0 ? (
                <EmptyState
                  compact
                  icon={CalendarClock}
                  title="No sessions scheduled"
                  description="Find a mentor who teaches what you want to learn. Booking arrives with matching in the next release."
                  action={
                    <Button size="sm" variant="secondary" to="/search">
                      Browse mentors
                    </Button>
                  }
                />
              ) : (
                <ul className={page.list}>
                  {data.upcomingSessions.map((s) => (
                    <SessionRow key={s.id} session={s} timezone={tz} compact />
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="My skills"
              action={
                <Link to="/skills" className={page.linkRow}>
                  Manage <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              <div className={page.stack} style={{ gap: 'var(--space-5)' }}>
                <div>
                  <p className={page.subheading}>I can teach</p>
                  {data.skills.teach.length ? (
                    <div className={page.chips}>
                      {data.skills.teach.map((t) => (
                        <SkillChip key={t.id} kind="teach" name={t.skill?.name} level={t.proficiency} />
                      ))}
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" leftIcon={Plus} to="/skills?tab=teach">
                      Add a skill you can teach
                    </Button>
                  )}
                </div>
                <div>
                  <p className={page.subheading}>I want to learn</p>
                  {data.skills.learn.length ? (
                    <div className={page.chips}>
                      {data.skills.learn.map((l) => (
                        <SkillChip key={l.id} kind="learn" name={l.skill?.name} level={l.preferredLevel} />
                      ))}
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" leftIcon={Plus} to="/skills?tab=learn">
                      Add a skill you want to learn
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className={page.grid2}>
            <Card title="Recent activity" subtitle="Your latest sessions">
              {data.recentActivity.length === 0 ? (
                <EmptyState
                  compact
                  icon={History}
                  title="No activity yet"
                  description="Completed sessions will show up here."
                />
              ) : (
                <ul className={page.list}>
                  {data.recentActivity.map((s) => (
                    <SessionRow key={s.id} session={s} timezone={tz} />
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Quick actions">
              <ul role="list" className={styles.actions}>
                <li>
                  <Link to="/search" className={styles.action}>
                    <Search size={20} aria-hidden="true" />
                    <span>
                      <strong>Find a mentor</strong>
                      <span>Search by skill</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link to="/skills" className={styles.action}>
                    <Plus size={20} aria-hidden="true" />
                    <span>
                      <strong>Add a skill</strong>
                      <span>Teach or learn something new</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link to="/availability" className={styles.action}>
                    <Clock size={20} aria-hidden="true" />
                    <span>
                      <strong>Set availability</strong>
                      <span>
                        {data.counts.availabilitySlots
                          ? `${data.counts.availabilitySlots} time ranges set`
                          : 'Not set yet'}
                      </span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link to="/profile/edit" className={styles.action}>
                    <UserRound size={20} aria-hidden="true" />
                    <span>
                      <strong>Edit profile</strong>
                      <span>Photo, bio and interests</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
