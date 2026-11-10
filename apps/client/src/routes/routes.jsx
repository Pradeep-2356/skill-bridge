import { useEffect } from 'react';
import { Navigate, Outlet, useLocation, useRouteError } from 'react-router';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { PublicLayout } from '../layouts/PublicLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { ProtectedRoute, GuestRoute, AdminRoute } from './guards.jsx';
import { ErrorState, Button } from '../components/ui/index.js';
import LandingPage from '../pages/LandingPage.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';
import { ForgotPasswordPage, ResetPasswordPage } from '../pages/auth/PasswordRecoveryPages.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';
import {
  MyProfilePage,
  EditProfilePage,
  ProfilePreviewPage,
  PublicProfilePage,
} from '../pages/profile/ProfilePages.jsx';
import SkillsPage from '../pages/SkillsPage.jsx';
import AvailabilityPage from '../pages/AvailabilityPage.jsx';
import SessionsPage from '../pages/SessionsPage.jsx';
import DiscoverPage from '../pages/DiscoverPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import { AdminUsersPage, AdminUserDetailPage } from '../pages/admin/AdminPages.jsx';
import AdminCatalogPage from '../pages/admin/AdminCatalogPage.jsx';
import { RequestsPage, RequestDetailPage } from '../pages/RequestsPages.jsx';
import MatchesPage from '../pages/MatchesPage.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Sprint 1 used /search; keep old links working by forwarding to /discover (SB2). */
function SearchRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/discover${search}`} replace />;
}

function Root() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ScrollToTop />
        <Outlet />
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Shown if a page crashes while rendering, instead of a blank screen (SB1/US42). */
function RouteError() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);
  return (
    <main style={{ maxWidth: 560, margin: '15vh auto', padding: 'var(--space-6)' }}>
      <ErrorState
        title="This page ran into a problem"
        message="Please reload the page. If it keeps happening, try again later."
        onRetry={() => window.location.reload()}
      />
      <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
        <Button variant="link" to="/">
          Go to the home page
        </Button>
      </div>
    </main>
  );
}

/** The whole route tree. Exported so tests can mount it in a memory router. */
export const routes = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <PublicLayout />, children: [{ index: true, element: <LandingPage /> }] },
      {
        element: <AuthLayout />,
        children: [
          {
            element: <GuestRoute />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/register', element: <RegisterPage /> },
              { path: '/forgot-password', element: <ForgotPasswordPage /> },
            ],
          },
          { path: '/reset-password/:token', element: <ResetPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: <DashboardPage /> },
              { path: '/profile', element: <MyProfilePage /> },
              { path: '/profile/edit', element: <EditProfilePage /> },
              { path: '/profile/preview', element: <ProfilePreviewPage /> },
              { path: '/users/:id', element: <PublicProfilePage /> },
              { path: '/skills', element: <SkillsPage /> },
              { path: '/availability', element: <AvailabilityPage /> },
              { path: '/sessions', element: <SessionsPage /> },
              { path: '/discover', element: <DiscoverPage /> },
              { path: '/search', element: <SearchRedirect /> },
              { path: '/requests', element: <RequestsPage /> },
              { path: '/requests/:id', element: <RequestDetailPage /> },
              { path: '/matches', element: <MatchesPage /> },
              { path: '/notifications', element: <NotificationsPage /> },
              { path: '/settings', element: <SettingsPage /> },
              {
                path: '/admin',
                element: <AdminRoute />,
                children: [
                  { path: 'users', element: <AdminUsersPage /> },
                  { path: 'users/:id', element: <AdminUserDetailPage /> },
                  { path: 'catalog', element: <AdminCatalogPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
