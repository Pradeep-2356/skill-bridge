import { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '../api.js';

export const POLL_MS = 30_000;
const EVENT = 'sb:notifications-changed';

/** Tells every bell on the page to refresh (after accept, decline, mark-as-read…). */
export const announceNotificationsChanged = () => window.dispatchEvent(new Event(EVENT));

/**
 * Unread notification count, refreshed every 30 seconds while the tab is visible
 * and whenever the app announces a change (SB2/US29 – simplified polling, no WebSockets).
 */
export function useUnreadCount({ pollMs = POLL_MS, refreshKey } = {}) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount();
      setCount(data.unreadCount);
    } catch {
      /* the bell is optional – never break the page because of it */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const tick = () => document.visibilityState === 'visible' && refresh();
    const timer = setInterval(tick, pollMs);
    window.addEventListener(EVENT, refresh);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener(EVENT, refresh);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh, pollMs]);

  return { count, refresh };
}
