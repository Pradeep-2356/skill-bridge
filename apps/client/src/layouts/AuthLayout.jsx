import { Outlet } from 'react-router';
import { CalendarClock, GraduationCap, Users } from 'lucide-react';
import { Logo } from '../components/Logo.jsx';
import { ThemeToggle } from '../features/theme/ThemeToggle.jsx';
import styles from './AuthLayout.module.css';

/** Split screen used by Login, Register and password recovery (SB1/US15). */
export function AuthLayout() {
  return (
    <div className={styles.shell}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className={styles.brand} aria-label="About SkillBridge">
        <Logo inverse />
        <div className={styles.pitch}>
          <h2 className={styles.pitchTitle}>Learn anything in 30 focused minutes.</h2>
          <p className={styles.pitchText}>
            Teach what you know, learn what you need. SkillBridge connects you with peers for short, practical
            one-on-one sessions.
          </p>
          <ul role="list" className={styles.points}>
            <li>
              <Users size={18} aria-hidden="true" /> Peers who teach and learn
            </li>
            <li>
              <GraduationCap size={18} aria-hidden="true" /> Skills from code to cooking
            </li>
            <li>
              <CalendarClock size={18} aria-hidden="true" /> Sessions that fit your time zone
            </li>
          </ul>
        </div>
        <div className={styles.chips} aria-hidden="true">
          <span className={styles.teach}>Teach · React</span>
          <span className={styles.learn}>Learn · Spanish</span>
          <span className={styles.teach}>Teach · Python</span>
          <span className={styles.learn}>Learn · Public speaking</span>
        </div>
      </aside>
      <main id="main" className={styles.main}>
        <div className={styles.themeCorner}>
          <ThemeToggle />
        </div>
        <div className={styles.mobileLogo}>
          <Logo />
        </div>
        <div className={styles.panel}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
