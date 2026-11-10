import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Sparkles, Wand2, Globe2, CalendarClock, SearchX, Send } from 'lucide-react';
import {
  PageHeader,
  Alert,
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  SkillChip,
} from '../components/ui/index.js';
import { ScoreBreakdown } from '../features/matches/ScoreBreakdown.jsx';
import { StatusBadge } from '../features/requests/RequestStatus.jsx';
import { RequestModal } from '../features/requests/RequestModal.jsx';
import { matchesApi, requestsApi } from '../features/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/misc.js';
import { formatDateTime, formatZoneGap } from '../utils/format.js';
import styles from '../features/matches/Matches.module.css';

/**
 * Suggested mentors (SB2/US17–24, US29, US46). Ranked by a simplified, transparent
 * points formula – the page says so, and shows every part of the score.
 */
export default function MatchesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const skillId = params.get('skill') ?? '';
  const [requestFor, setRequestFor] = useState(null);
  const [autoBusy, setAutoBusy] = useState(false);
  useDocumentTitle('Suggested mentors');
  const { data, loading, error, reload } = useApi(() => matchesApi.suggestions(skillId ? { skillId } : {}), [skillId]);

  async function findAutomatically() {
    const target = skillId || data?.learnSkills?.[0]?.id;
    if (!target) return;
    setAutoBusy(true);
    try {
      const { data: res } = await requestsApi.create({ mode: 'auto', skillId: target });
      toast.success('We are finding the best mentor for you. You will get a notification.');
      navigate(`/requests/${res.request.id}`);
    } catch (err) {
      if (err.code === 'DUPLICATE_REQUEST' && err.details?.requestId) {
        toast.info('You already have an automatic request open for this skill.');
        navigate(`/requests/${err.details.requestId}`);
      } else toast.error(err.message);
    } finally {
      setAutoBusy(false);
    }
  }

  const learnSkills = data?.learnSkills ?? [];

  return (
    <>
      <PageHeader
        title="Suggested mentors"
        subtitle="Mentors ranked for the skills you want to learn, with the reasons behind each match."
      />
      <Alert tone="info" className={styles.disclaimer}>
        Simplified matching: a fixed points formula (skill, level, shared time, time zone, skill swap). It is not
        machine learning.
      </Alert>

      {learnSkills.length ? (
        <div className={styles.controls}>
          <Select
            id="match-skill"
            label="Skill to learn"
            value={skillId}
            onChange={(e) => setParams(e.target.value ? { skill: e.target.value } : {})}
            options={[
              { value: '', label: 'All my learning skills' },
              ...learnSkills.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Button variant="secondary" leftIcon={Wand2} loading={autoBusy} onClick={findAutomatically}>
            Match me automatically{skillId ? '' : ` for ${learnSkills[0].name}`}
          </Button>
        </div>
      ) : null}

      {data && !data.hasAvailability && learnSkills.length ? (
        <Alert tone="warning" title="Add your availability for better matches">
          Without your free times we cannot find shared time. <Link to="/availability">Set your availability</Link>
        </Alert>
      ) : null}

      <div aria-live="polite" aria-busy={loading}>
        {loading || (!data && !error) ? (
          <div className={styles.list}>
            {[1, 2].map((n) => (
              <Skeleton key={n} height={220} radius="var(--radius-lg)" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data.matches.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={data.reason?.reason ?? 'No suggestions yet'}
            description={data.reason?.nextStep}
            action={
              data.reason?.code === 'NO_LEARN_SKILLS' ? (
                <Button to="/skills?tab=learn">Add a learning skill</Button>
              ) : (
                <Button variant="secondary" to="/discover">
                  Browse all mentors
                </Button>
              )
            }
          />
        ) : (
          <ol className={styles.list} aria-label="Suggested mentors, best first">
            {data.matches.map((m, i) => (
              <li key={`${m.mentor.id}-${m.skill.id}`} className={styles.match}>
                <div className={styles.matchWho}>
                  <div className={styles.matchHead}>
                    <span className={styles.rank} aria-label={`Rank ${i + 1}`}>
                      {i + 1}
                    </span>
                    <Avatar name={m.mentor.name} src={m.mentor.avatarUrl} size={48} />
                    <div>
                      <p className={styles.matchName}>
                        <Link to={`/users/${m.mentor.id}`}>{m.mentor.name}</Link>
                      </p>
                      {m.mentor.headline ? <p className={styles.matchMeta}>{m.mentor.headline}</p> : null}
                    </div>
                  </div>
                  <SkillChip kind="teach" name={m.skill.name} level={m.mentorLevel} />
                  <ul role="list" className={styles.matchMeta}>
                    <li>
                      <Globe2 size={14} aria-hidden="true" /> {m.mentor.timezone.replace(/_/g, ' ')} ·{' '}
                      {formatZoneGap(m.tzGapHours)}
                    </li>
                    {m.proposedSlot ? (
                      <li>
                        <CalendarClock size={14} aria-hidden="true" />{' '}
                        {m.proposedSlot.shared ? 'First shared slot' : 'Mentor’s next free slot'}:{' '}
                        {formatDateTime(m.proposedSlot.startsAt, user.timezone)}
                      </li>
                    ) : null}
                  </ul>
                  <div className={styles.matchActions}>
                    {m.existingRequest ? (
                      <Link to={`/requests/${m.existingRequest.id}`} aria-label="Open your existing request">
                        <StatusBadge
                          status={m.existingRequest.status}
                          label={`Already requested · ${m.existingRequest.status}`}
                        />
                      </Link>
                    ) : (
                      <Button size="sm" leftIcon={Send} onClick={() => setRequestFor(m)}>
                        Request {m.mentor.name.split(' ')[0]}
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" to={`/users/${m.mentor.id}`}>
                      View profile
                    </Button>
                  </div>
                </div>
                <ScoreBreakdown score={m.score} reasons={m.reasons} notes={m.notes} compact />
              </li>
            ))}
          </ol>
        )}
      </div>

      {requestFor ? (
        <RequestModal
          open
          onClose={() => setRequestFor(null)}
          mentor={requestFor.mentor}
          skills={[{ skill: requestFor.skill, proficiency: requestFor.mentorLevel }]}
          preselectId={requestFor.skill.id}
          nextSlot={requestFor.proposedSlot}
          viewerTimezone={user.timezone}
        />
      ) : null}
      <p className={styles.matchMeta} style={{ marginTop: 'var(--space-6)' }}>
        <Sparkles size={14} aria-hidden="true" /> Suggestions update when you change your skills or availability.
      </p>
    </>
  );
}
