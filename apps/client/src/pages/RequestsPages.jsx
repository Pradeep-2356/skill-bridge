import { Link, useParams, useSearchParams } from 'react-router';
import {
  Inbox,
  Send,
  Compass,
  CalendarClock,
  MessageSquareQuote,
  Sparkles,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  PageHeader,
  Tabs,
  Card,
  Avatar,
  SkillChip,
  Skeleton,
  EmptyState,
  ErrorState,
  Pagination,
  Alert,
  Button,
  levelLabel,
} from '../components/ui/index.js';
import { StatusBadge, StatusTimeline } from '../features/requests/RequestStatus.jsx';
import { RequestActions } from '../features/requests/RequestActions.jsx';
import { ScoreBreakdown } from '../features/matches/ScoreBreakdown.jsx';
import { requestsApi } from '../features/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/misc.js';
import { formatDateTime, relativeTime, formatMinutes } from '../utils/format.js';
import styles from '../features/requests/Requests.module.css';

const BOXES = [
  { id: 'incoming', label: 'Received', icon: Inbox },
  { id: 'outgoing', label: 'Sent', icon: Send },
];
const GROUPS = [
  { id: 'open', label: 'Open' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];
const EMPTY = {
  incoming: {
    open: ['No requests waiting for you', 'When a learner asks you for a session it appears here.'],
    accepted: ['No accepted requests yet', 'Requests you accept become matches with a booked session.'],
    closed: ['Nothing here', 'Declined, cancelled and expired requests appear here.'],
    all: ['No requests yet', 'Add skills you can teach so learners can find you.'],
  },
  outgoing: {
    open: ['No open requests', 'Find a mentor and send a request to start learning.'],
    accepted: ['No matches yet', 'When a mentor accepts your request, it appears here.'],
    closed: ['Nothing here', 'Declined, cancelled, expired and unmatched requests appear here.'],
    all: ['You have not sent any requests', 'Find a mentor on the Discover page or try your suggestions.'],
  },
};

/** One request in the hub list. */
function RequestRow({ request, timezone, onChanged }) {
  const partner = request.partner;
  const when = request.session?.startsAt ?? request.proposedSlot?.startsAt;
  return (
    <li className={styles.row}>
      <Avatar name={partner?.name ?? '?'} src={partner?.avatarUrl} size={44} />
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          <p className={styles.rowName}>
            {partner ? (
              <Link to={`/users/${partner.id}`}>{partner.name}</Link>
            ) : (
              <span className={styles.finding}>Finding a mentor…</span>
            )}
          </p>
          <StatusBadge status={request.status} />
          {request.mode === 'auto' ? <span className={styles.autoTag}>Auto-matched</span> : null}
        </div>
        <div className={styles.rowMeta}>
          {request.skill ? (
            <SkillChip kind={request.role === 'mentor' ? 'teach' : 'learn'} name={request.skill.name} />
          ) : null}
          <span>
            {request.role === 'mentor' ? 'Received' : 'Sent'} {relativeTime(request.createdAt)}
          </span>
          {when && ['pending', 'accepted'].includes(request.status) ? (
            <span className={styles.rowWhen}>
              <CalendarClock size={14} aria-hidden="true" /> {request.status === 'accepted' ? 'Session' : 'Proposed'}{' '}
              {formatDateTime(when, timezone)}
            </span>
          ) : null}
        </div>
        {request.message ? <p className={styles.rowMessage}>“{request.message}”</p> : null}
        {request.failure ? <p className={styles.rowFailure}>{request.failure.reason}</p> : null}
      </div>
      <div className={styles.rowActions}>
        <RequestActions request={request} size="sm" onChanged={onChanged} />
        <Link
          to={`/requests/${request.id}`}
          className={styles.detailsLink}
          aria-label={`Details of request with ${partner?.name ?? 'mentor'}`}
        >
          Details <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

/** Requests hub: received and sent requests by status (SB2/US13, US26–28). */
export function RequestsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const box = params.get('box') === 'outgoing' ? 'outgoing' : 'incoming';
  const status = GROUPS.some((g) => g.id === params.get('status')) ? params.get('status') : 'open';
  const page = Math.max(1, Number(params.get('page')) || 1);
  useDocumentTitle('Learning requests');
  const { data, meta, loading, error, reload } = useApi(
    () => requestsApi.list({ box, status, page, limit: 10 }),
    [box, status, page],
  );
  const set = (patch) => setParams({ box, status, ...patch });
  const [emptyTitle, emptyText] = EMPTY[box][status];

  return (
    <>
      <PageHeader
        title="Learning requests"
        subtitle="Requests you have received as a mentor and sent as a learner."
        actions={
          <Button variant="secondary" leftIcon={Sparkles} to="/matches">
            Suggested mentors
          </Button>
        }
      />
      <Tabs
        tabs={BOXES}
        value={box}
        onChange={(id) => set({ box: id, status: 'open' })}
        label="Request folders"
        idPrefix="box"
      />
      <div role="tabpanel" id={`box-panel-${box}`} aria-labelledby={`box-${box}`} className={styles.panel}>
        <div className={styles.groups} role="group" aria-label="Filter by status">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={status === g.id}
              className={styles.group}
              onClick={() => set({ status: g.id })}
            >
              {g.label}
              {meta?.counts ? <span className={styles.groupCount}>{meta.counts[g.id]}</span> : null}
            </button>
          ))}
        </div>
        <div aria-live="polite" aria-busy={loading}>
          {loading || (!data && !error) ? (
            <div className={styles.list}>
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} height={96} radius="var(--radius-lg)" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : data.requests.length === 0 ? (
            <EmptyState
              icon={box === 'incoming' ? Inbox : Send}
              title={emptyTitle}
              description={emptyText}
              action={
                box === 'outgoing' ? (
                  <Button leftIcon={Compass} to="/discover">
                    Find a mentor
                  </Button>
                ) : (
                  <Button variant="secondary" to="/skills">
                    Manage your skills
                  </Button>
                )
              }
            />
          ) : (
            <>
              <ul className={styles.list} aria-label={`${box === 'incoming' ? 'Received' : 'Sent'} requests`}>
                {data.requests.map((r) => (
                  <RequestRow key={r.id} request={r} timezone={user.timezone} onChanged={reload} />
                ))}
              </ul>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onChange={(p) => set({ page: String(p) })}
                label="Request pages"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** One request in full: people, skill, time, score, reasons and history (SB2/US25, US27, US30, US31). */
export function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useApi(() => requestsApi.get(id), [id]);
  const request = data?.request;
  useDocumentTitle(request?.skill ? `${request.skill.name} request` : 'Request');
  const tz = user.timezone;

  return (
    <>
      <PageHeader
        title={request?.skill ? `${request.skill.name} request` : 'Request'}
        backTo="/requests"
        backLabel="Back to requests"
      />
      {loading && !request ? (
        <Skeleton height={320} radius="var(--radius-lg)" />
      ) : error ? (
        error.status === 403 || error.status === 404 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Request not available"
            description={error.message}
            action={<Button to="/requests">Back to requests</Button>}
          />
        ) : (
          <ErrorState message={error.message} onRetry={reload} />
        )
      ) : request ? (
        <div className={styles.detail}>
          <div className={styles.detailMain}>
            <Card>
              <div className={styles.detailHead}>
                <StatusBadge status={request.status} />
                {request.mode === 'auto' ? <span className={styles.autoTag}>Auto-matched</span> : null}
                <RequestActions
                  request={request}
                  onChanged={(updated) => (updated ? setData({ request: updated.request ?? updated }) : reload())}
                />
              </div>
              {request.status === 'queued' ? (
                <Alert tone="info" title="Matching in progress">
                  This usually takes a few seconds.{' '}
                  <Button variant="link" onClick={reload}>
                    Refresh
                  </Button>
                </Alert>
              ) : null}
              {request.failure ? (
                <Alert tone="warning" title={request.failure.reason}>
                  {request.failure.nextStep}
                </Alert>
              ) : null}
              {request.status === 'declined' && request.declineReason ? (
                <Alert tone="info" title="Reason given">
                  {request.declineReason}
                </Alert>
              ) : null}
              <dl className={styles.facts}>
                <div>
                  <dt>Skill</dt>
                  <dd>
                    {request.skill?.name} · wants {levelLabel('learn', request.learnerLevel).toLowerCase()} level
                  </dd>
                </div>
                {request.session ? (
                  <div>
                    <dt>Session</dt>
                    <dd>
                      <strong>{formatDateTime(request.session.startsAt, tz)}</strong> your time ·{' '}
                      {request.session.durationMinutes} min
                      {request.partner ? (
                        <span className={styles.otherZone}>
                          {' '}
                          ({formatDateTime(request.session.startsAt, request.partner.timezone)} for{' '}
                          {request.partner.name.split(' ')[0]})
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : request.proposedSlot ? (
                  <div>
                    <dt>Proposed time</dt>
                    <dd>
                      {formatDateTime(request.proposedSlot.startsAt, tz)} your time ·{' '}
                      {request.proposedSlot.shared ? 'you are both free then' : 'from the mentor’s availability'}
                    </dd>
                  </div>
                ) : null}
                {request.sharedMinutes ? (
                  <div>
                    <dt>Shared free time</dt>
                    <dd>{formatMinutes(request.sharedMinutes)} a week</dd>
                  </div>
                ) : null}
                {request.expiresAt && request.status === 'pending' ? (
                  <div>
                    <dt>Expires</dt>
                    <dd>{relativeTime(request.expiresAt)} if there is no reply</dd>
                  </div>
                ) : null}
              </dl>
              {request.message ? (
                <blockquote className={styles.quote}>
                  <MessageSquareQuote size={16} aria-hidden="true" /> {request.message}
                </blockquote>
              ) : null}
            </Card>
            {request.score ? (
              <Card title="Match score" subtitle="How the simplified matching rules scored this pair">
                <ScoreBreakdown score={request.score} reasons={request.reasons} notes={request.notes} />
              </Card>
            ) : null}
          </div>
          <aside className={styles.detailSide}>
            {[
              ['Learner', request.learner],
              ['Mentor', request.mentor],
            ].map(([label, person]) =>
              person ? (
                <Card key={label} title={label}>
                  <div className={styles.person}>
                    <Avatar name={person.name} src={person.avatarUrl} size={48} />
                    <div>
                      <p className={styles.rowName}>
                        {person.id === user.id ? (
                          `${person.name} (you)`
                        ) : (
                          <Link to={`/users/${person.id}`}>{person.name}</Link>
                        )}
                      </p>
                      {person.headline ? <p className={styles.personHeadline}>{person.headline}</p> : null}
                      <p className={styles.personZone}>{person.timezone.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  {person.id !== user.id ? (
                    <Button variant="secondary" size="sm" to={`/users/${person.id}`} fullWidth>
                      View profile
                    </Button>
                  ) : null}
                </Card>
              ) : null,
            )}
            <Card title="History">
              <StatusTimeline history={request.history} timezone={tz} />
            </Card>
          </aside>
        </div>
      ) : null}
    </>
  );
}
