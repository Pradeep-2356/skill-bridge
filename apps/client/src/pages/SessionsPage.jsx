import { useSearchParams } from 'react-router';
import { CalendarClock, History, Info } from 'lucide-react';
import {
  PageHeader,
  Tabs,
  TabPanel,
  EmptyState,
  ErrorState,
  Skeleton,
  Pagination,
  Alert,
  Button,
} from '../components/ui/index.js';
import { SessionRow } from '../features/sessions/SessionRow.jsx';
import { sessionsApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';
import page from './Page.module.css';

/** SB1/US37–39: upcoming and past sessions, shown in the user’s own time zone. */
export default function SessionsPage() {
  useDocumentTitle('Sessions');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const scope = params.get('tab') === 'past' ? 'past' : 'upcoming';
  const pageNo = Math.max(1, Number(params.get('page')) || 1);
  const { data, meta, loading, error, reload } = useApi(
    () => sessionsApi.list({ scope, page: pageNo, limit: 10 }),
    [scope, pageNo],
  );

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', icon: CalendarClock },
    { id: 'past', label: 'Past', icon: History },
  ];

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle={`All times are shown in your time zone (${user.timezone.replace(/_/g, ' ')}).`}
      />
      <Alert tone="info" title="Booking is coming next">
        <Info size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> In this release you
        can view sessions. Requesting and booking sessions with mentors arrives with matching. Sessions marked “Demo”
        are sample data.
      </Alert>
      <div style={{ marginTop: 'var(--space-6)' }}>
        <Tabs
          tabs={tabs}
          value={scope}
          onChange={(id) => setParams({ tab: id })}
          label="Session lists"
          idPrefix="sessions"
        />
        <TabPanel id={scope} idPrefix="sessions">
          {loading || (!data && !error) ? (
            <Skeleton height={88} count={3} gap={12} radius="var(--radius-md)" />
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : data.sessions.length === 0 ? (
            <EmptyState
              icon={scope === 'upcoming' ? CalendarClock : History}
              title={scope === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
              description={
                scope === 'upcoming'
                  ? 'When you have a session scheduled, it will appear here.'
                  : 'Sessions you have taken part in will appear here.'
              }
              action={scope === 'upcoming' ? <Button to="/discover">Find a mentor</Button> : null}
            />
          ) : (
            <>
              <ul className={page.list}>
                {data.sessions.map((s) => (
                  <SessionRow key={s.id} session={s} timezone={user.timezone} />
                ))}
              </ul>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onChange={(p) => setParams({ tab: scope, page: String(p) })}
                label="Sessions pages"
              />
            </>
          )}
        </TabPanel>
      </div>
    </>
  );
}
