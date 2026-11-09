import { Outlet } from 'react-router';
import { Logo } from '../components/Logo.jsx';
import { Button } from '../components/ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import styles from './PublicLayout.module.css';

export function PublicLayout() {
  const { isAuthenticated } = useAuth();
  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Logo />
          <nav aria-label="Account" className={styles.actions}>
            {isAuthenticated ? (
              <Button to="/dashboard">Go to dashboard</Button>
            ) : (
              <>
                <Button to="/login" variant="ghost">
                  Log in
                </Button>
                <Button to="/register">Sign up free</Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <span>© {new Date().getFullYear()} SkillBridge · Peer-to-peer micro-learning</span>
          <span className={styles.footerNote}>Final-year B.Tech project</span>
        </div>
      </footer>
    </div>
  );
}
