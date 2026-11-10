import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router';
import {
  LayoutDashboard,
  Search,
  CalendarClock,
  UserRound,
  Sparkles,
  Clock,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Inbox,
  HeartHandshake,
  Tags,
} from 'lucide-react';
import { Logo } from '../components/Logo.jsx';
import { Avatar } from '../components/ui/index.js';
import { NotificationBell } from '../features/notifications/NotificationBell.jsx';
import { ThemeToggle } from '../features/theme/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import styles from './AppLayout.module.css';

/** Main navigation (SB1/US39). Admin appears only for admins (SB1/US47). */
const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/discover', label: 'Find mentors', icon: Search },
  { to: '/matches', label: 'Suggested', icon: HeartHandshake },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/sessions', label: 'Sessions', icon: CalendarClock },
  { to: '/profile', label: 'My profile', icon: UserRound },
  { to: '/skills', label: 'Skills', icon: Sparkles },
  { to: '/availability', label: 'Availability', icon: Clock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function SidebarNav({ isAdmin, onNavigate }) {
  return (
    <nav aria-label="Main" className={styles.nav}>
      <ul role="list" className={styles.navList}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={onNavigate}
            >
              <Icon size={20} aria-hidden="true" />
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      {isAdmin ? (
        <>
          <p className={styles.navSection}>Administration</p>
          <ul role="list" className={styles.navList}>
            <li>
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onNavigate}
              >
                <ShieldCheck size={20} aria-hidden="true" />
                <span className={styles.navLabel}>Manage users</span>
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/catalog"
                className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                onClick={onNavigate}
              >
                <Tags size={20} aria-hidden="true" />
                <span className={styles.navLabel}>Skill catalogue</span>
              </NavLink>
            </li>
          </ul>
        </>
      ) : null}
    </nav>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.userMenu} ref={ref}>
      <button
        type="button"
        className={styles.userButton}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} src={user.avatarUrl} size={34} />
        <span className={styles.userName}>{user.name}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <div className={styles.menuHeader}>
            <p className={styles.menuName}>{user.name}</p>
            <p className={styles.menuEmail}>{user.email}</p>
          </div>
          <Link role="menuitem" to="/profile" className={styles.menuItem} onClick={() => setOpen(false)}>
            <UserRound size={16} aria-hidden="true" /> My profile
          </Link>
          <Link role="menuitem" to="/settings" className={styles.menuItem} onClick={() => setOpen(false)}>
            <Settings size={16} aria-hidden="true" /> Account settings
          </Link>
          <button
            role="menuitem"
            type="button"
            className={`${styles.menuItem} ${styles.menuDanger}`}
            onClick={onLogout}
          >
            <LogOut size={16} aria-hidden="true" /> Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Signed-in shell: sidebar, top bar with search and account menu, page content. */
export function AppLayout() {
  const { user, isAdmin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  async function handleLogout() {
    await logout();
    toast.success('You have been logged out.');
    navigate('/login', { replace: true });
  }

  function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/discover?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`} aria-label="Sidebar">
        <div className={styles.sidebarTop}>
          <Logo to="/dashboard" />
          <button
            type="button"
            className={styles.drawerClose}
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <SidebarNav isAdmin={isAdmin} onNavigate={() => setDrawerOpen(false)} />
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.navLink} onClick={handleLogout}>
            <LogOut size={20} aria-hidden="true" />
            <span className={styles.navLabel}>Log out</span>
          </button>
        </div>
      </aside>
      {drawerOpen ? <div className={styles.scrim} onClick={() => setDrawerOpen(false)} aria-hidden="true" /> : null}

      <div className={styles.column}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuToggle}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <form role="search" className={styles.search} onSubmit={handleSearch}>
            <label htmlFor="global-search" className="sr-only">
              Search skills or mentors
            </label>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              id="global-search"
              type="search"
              placeholder="Search skills or mentors…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.searchInput}
              maxLength={60}
            />
          </form>
          <div className={styles.topActions}>
            <ThemeToggle />
            <NotificationBell />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>
        <main id="main" className={styles.main} tabIndex={-1}>
          <div className={styles.content}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
