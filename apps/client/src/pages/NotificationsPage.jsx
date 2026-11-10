import { useNavigate, useSearchParams } from 'react-router';
import { BellOff, CheckCheck, Check } from 'lucide-react';
import {
  PageHeader,
  Tabs,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Pagination,
  IconButton,
} from '../components/ui/index.js';
import { NotificationItem } from '../features/notifications/NotificationItem.jsx';
import { announceNotificationsChanged, POLL_MS } from '../features/notifications/useNotifications.js';
import { notificationsApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/misc.js';
import { useToast } from '../context/ToastContext.jsx';
import styles from '../features/notifications/Notifications.module.css';

/** Notification history with read/unread state (SB2/US29). */
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const filter = params.get('filter') === 'unread' ? 'unread' : 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  useDocumentTitle('Notifications');
  const { data, meta, loading, error, reload, setData } = useApi(
    () => notificationsApi.list({ unread: filter === 'unread' || undefined, page, limit: 15 }),
    [filter, page],
  );

  const markLocally = (id) =>
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (id === 'all' || n.id === id ? { ...n, read: true } : n)),
    }));

  async function markOne(n) {
    await notificationsApi.markRead(n.id);
    markLocally(n.id);
    announceNotificationsChanged();
  }

  async function open(n) {
    if (!n.read) await markOne(n).catch(() => null);
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    try {
      const { data: res } = await notificationsApi.markAllRead();
      markLocally('all');
      announceNotificationsChanged();
      toast.success(res.updated ? `Marked ${res.updated} as read.` : 'Everything was already read.');
      if (filter === 'unread') reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`Request and match updates. New ones are checked every ${POLL_MS / 1000} seconds.`}
        actions={
          <Button variant="secondary" leftIcon={CheckCheck} onClick={markAll} disabled={!meta?.unreadCount}>
            Mark all as read
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread', count: meta?.unreadCount },
        ]}
        value={filter}
        onChange={(id) => setParams(id === 'unread' ? { filter: 'unread' } : {})}
        label="Notification filter"
        idPrefix="notes"
      />
      <div role="tabpanel" id={`notes-panel-${filter}`} aria-labelledby={`notes-${filter}`} className={styles.page}>
        {loading || (!data && !error) ? (
          [1, 2, 3].map((n) => <Skeleton key={n} height={72} radius="var(--radius-md)" />)
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data.notifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="You will be notified when someone sends, accepts or declines a learning request."
          />
        ) : (
          <>
            <ul className={styles.pageList} aria-label="Notifications">
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <NotificationItem notification={n} onOpen={open}>
                    {n.read ? null : (
                      <IconButton
                        icon={Check}
                        label={`Mark “${n.title}” as read`}
                        size="sm"
                        onClick={() => markOne(n)}
                      />
                    )}
                  </NotificationItem>
                </li>
              ))}
            </ul>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onChange={(p) => setParams({ ...(filter === 'unread' ? { filter } : {}), page: String(p) })}
              label="Notification pages"
            />
          </>
        )}
      </div>
    </>
  );
}
