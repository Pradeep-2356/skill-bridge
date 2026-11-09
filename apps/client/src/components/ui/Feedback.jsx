import { AlertTriangle, Inbox, RotateCw, CheckCircle2, Info, XCircle } from 'lucide-react';
import styles from './Feedback.module.css';

export function Spinner({ size = 'md', tone = 'primary', label }) {
  return (
    <span
      className={`${styles.spinner} ${styles[`spinner-${size}`]} ${styles[`spinner-${tone}`]}`}
      role={label ? 'status' : undefined}
    >
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** Grey placeholder shapes shown while data loads (SB1/US43). */
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 'var(--radius-sm)',
  count = 1,
  gap = 8,
  className = '',
}) {
  return (
    <span className={`${styles.skeletonGroup} ${className}`} style={{ gap }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={styles.skeleton} style={{ width, height, borderRadius: radius }} />
      ))}
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false }) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`}>
      <span className={styles.emptyIcon}>
        <Icon size={compact ? 20 : 24} aria-hidden="true" />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyText}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, compact = false }) {
  return (
    <div className={`${styles.empty} ${styles.error} ${compact ? styles.compact : ''}`} role="alert">
      <span className={`${styles.emptyIcon} ${styles.errorIcon}`}>
        <AlertTriangle size={compact ? 20 : 24} aria-hidden="true" />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {message ? <p className={styles.emptyText}>{message}</p> : null}
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RotateCw size={16} aria-hidden="true" /> Try again
        </button>
      ) : null}
    </div>
  );
}

/**
 * Renders exactly one of: skeleton, error (with Retry), empty state, or content.
 * Every data area in the app goes through this (Stage 3 "one rule for states").
 */
export function AsyncView({ loading, error, isEmpty, skeleton, empty, onRetry, children }) {
  if (loading) return skeleton ?? <Skeleton count={3} height={20} />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} compact />;
  if (isEmpty) return empty ?? null;
  return children;
}

const TONE_ICONS = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle, info: Info };

export function Alert({ tone = 'info', title, children, className = '' }) {
  const Icon = TONE_ICONS[tone] ?? Info;
  return (
    <div
      className={`${styles.alert} ${styles[`alert-${tone}`]} ${className}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon size={18} aria-hidden="true" className={styles.alertIcon} />
      <div>
        {title ? <p className={styles.alertTitle}>{title}</p> : null}
        {children ? <div className={styles.alertBody}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Small label. Status is never colour-only: badges always carry a word (WCAG). */
export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`${styles.badge} ${styles[`badge-${tone}`]} ${className}`}>
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
