import { Link } from 'react-router';
import styles from './Logo.module.css';

export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
      <path d="M7 20c3-6 15-6 18 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9" cy="21" r="2.6" fill="#14B8A6" />
      <circle cx="23" cy="21" r="2.6" fill="#F59E0B" />
    </svg>
  );
}

export function Logo({ to = '/', compact = false, inverse = false }) {
  return (
    <Link to={to} className={`${styles.logo} ${inverse ? styles.inverse : ''}`} aria-label="SkillBridge home">
      <LogoMark />
      {!compact ? <span className={styles.word}>SkillBridge</span> : null}
    </Link>
  );
}
