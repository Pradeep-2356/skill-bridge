import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { Spinner } from '../../components/ui/index.js';
import { notificationsApi } from '../api.js';
import { useUnreadCount, announceNotificationsChanged } from './useNotifications.js';
import { NotificationItem } from './NotificationItem.jsx';
import styles from './Notifications.module.css';

/** Bell with an unread badge and a menu of the latest notifications (SB2/US29). */
export function NotificationBell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { count, refresh } = useUnreadCount({ refreshKey: location.pathname });
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setItems(null);
    notificationsApi
      .list({ limit: 6 })
      .then(({ data }) => alive && setItems(data.notifications))
      .catch(() => alive && setItems([]));
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [location.pathname]);

  async function openItem(n) {
    if (!n.read) {
      await notificationsApi.markRead(n.id).catch(() => null);
      announceNotificationsChanged();
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    await notificationsApi.markAllRead();
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list);
    announceNotificationsChanged();
    refresh();
  }

  const label = count ? `Notifications, ${count} unread` : 'Notifications';
  return (
    <div className={styles.bellWrap} ref={ref}>
      <button
        type="button"
        className={styles.bell}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={20} aria-hidden="true" />
        {count ? (
          <span className={styles.badge} aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Recent notifications">
          <div className={styles.panelHead}>
            <p className={styles.panelTitle}>Notifications</p>
            {count ? (
              <button type="button" className={styles.linkButton} onClick={markAll}>
                <CheckCheck size={14} aria-hidden="true" /> Mark all as read
              </button>
            ) : null}
          </div>
          <div className={styles.panelList}>
            {items === null ? (
              <div className={styles.panelEmpty}>
                <Spinner label="Loading notifications" />
              </div>
            ) : items.length === 0 ? (
              <p className={styles.panelEmpty}>You are all caught up.</p>
            ) : (
              items.map((n) => <NotificationItem key={n.id} notification={n} onOpen={openItem} compact />)
            )}
          </div>
          <Link to="/notifications" className={styles.panelFoot}>
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
