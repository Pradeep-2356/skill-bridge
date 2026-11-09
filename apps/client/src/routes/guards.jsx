import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, EmptyState, Button } from '../components/ui/index.js';

/** Only allow internal redirects ("/skills"), never "//evil.com" or "https://…". */
export function safeNext(next) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function FullPageLoader({ label = 'Loading SkillBridge…' }) {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <Spinner size="lg" label={label} />
    </div>
  );
}

/**
 * Signed-in pages. While the session check runs, show a loader (no flash of the
 * login page). Guests are sent to Login and come back afterwards (SB1/US10, US13).
 * The server still checks every request on its own; this guard is for UX only.
 */
export function ProtectedRoute() {
  const { status, reason } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'guest') {
    // After "Log out" or deleting an account, go to a clean login page / home page.
    if (reason === 'logout') return <Navigate to="/login" replace />;
    if (reason === 'left') return <Navigate to="/" replace />;
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Login/Register: a signed-in user goes straight to where they were heading. */
export function GuestRoute() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to={safeNext(params.get('next')) ?? '/dashboard'} replace />;
  return <Outlet />;
}

/** Admin area (SB1/US47–49). */
export function AdminRoute() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Administrators only"
        description="This area is only available to SkillBridge administrators."
        action={<Button to="/dashboard">Back to dashboard</Button>}
      />
    );
  }
  return <Outlet />;
}
