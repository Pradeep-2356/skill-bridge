import { useRef } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PROFICIENCY_LEVELS, LEARNING_LEVELS } from '@skillbridge/shared';
import styles from './Display.module.css';

export function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  padded = true,
  as: Tag = 'section',
  titleId,
}) {
  return (
    <Tag className={`${styles.card} ${className}`} aria-labelledby={title && titleId ? titleId : undefined}>
      {title || action ? (
        <header className={styles.cardHeader}>
          <div>
            {title ? (
              <h2 className={styles.cardTitle} id={titleId}>
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className={styles.cardSubtitle}>{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={padded ? styles.cardBody : ''}>{children}</div>
    </Tag>
  );
}

const AVATAR_COLOURS = ['#4F46E5', '#0F766E', '#B45309', '#7C3AED', '#0369A1', '#BE185D', '#15803D', '#C2410C'];

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

function colourFor(name = '') {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

/** Photo, or coloured initials when there is no photo. */
export function Avatar({ name, src, size = 40, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)) };
  if (src) {
    return <img src={src} alt={`${name}'s profile photo`} className={`${styles.avatar} ${className}`} style={style} />;
  }
  return (
    <span
      className={`${styles.avatar} ${styles.initials} ${className}`}
      style={{ ...style, background: colourFor(name) }}
      role="img"
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}

const LEVELS = { teach: PROFICIENCY_LEVELS, learn: LEARNING_LEVELS };

export function levelLabel(kind, value) {
  return LEVELS[kind].find((l) => l.value === value)?.label ?? value;
}

/** 1–4 dots showing a level; the word is always present for screen readers. */
export function LevelDots({ kind = 'teach', value }) {
  const levels = LEVELS[kind];
  const rank = levels.find((l) => l.value === value)?.rank ?? 0;
  return (
    <span className={styles.dots} aria-hidden="true">
      {levels.map((l) => (
        <span key={l.value} className={`${styles.dot} ${l.rank <= rank ? styles[`dotOn-${kind}`] : ''}`} />
      ))}
    </span>
  );
}

/** Teach chips are teal, learn chips are amber – everywhere (Stage 3 design rule). */
export function SkillChip({ kind = 'teach', name, level, onRemove, pending = false }) {
  return (
    <span className={`${styles.chip} ${styles[`chip-${kind}`]}`}>
      <span className={styles.chipName}>{name}</span>
      {level ? (
        <>
          <LevelDots kind={kind} value={level} />
          <span className="sr-only">, {levelLabel(kind, level)}</span>
        </>
      ) : null}
      {pending ? <span className={styles.chipPending}>in review</span> : null}
      {onRemove ? (
        <button type="button" className={styles.chipRemove} onClick={onRemove} aria-label={`Remove ${name}`}>
          <X size={12} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

export function ProgressRing({ percent = 0, size = 72, stroke = 7, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div
      className={styles.ring}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${percent}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={percent === 100 ? 'var(--color-success)' : 'var(--color-primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.ringValue}
        />
      </svg>
      <span className={styles.ringLabel} aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, backTo, backLabel = 'Back' }) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        {backTo ? (
          <Link to={backTo} className={styles.back}>
            <ArrowLeft size={16} aria-hidden="true" /> {backLabel}
          </Link>
        ) : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}

/** Accessible tabs: arrow keys move between tabs (WAI-ARIA tabs pattern). */
export function Tabs({ tabs, value, onChange, label, idPrefix = 'tab' }) {
  const refs = useRef([]);
  function onKeyDown(e, index) {
    let next = null;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      refs.current[next]?.focus();
      onChange(tabs[next].id);
    }
  }
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={`${styles.tab} ${selected ? styles.tabActive : ''} ${tab.tone ? styles[`tab-${tab.tone}`] : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {Icon ? <Icon size={16} aria-hidden="true" /> : null}
            {tab.label}
            {tab.count !== undefined ? <span className={styles.tabCount}>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, idPrefix = 'tab', children }) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-${id}`}
      tabIndex={0}
      className={styles.tabPanel}
    >
      {children}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange, label = 'Pagination' }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label={label}>
      <button type="button" className={styles.pageButton} onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <span className={styles.pageInfo} aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className={styles.pageButton}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'primary', to }) {
  const body = (
    <>
      <span className={`${styles.statIcon} ${styles[`statIcon-${tone}`]}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className={styles.statText}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
        {hint ? <span className={styles.statHint}>{hint}</span> : null}
      </span>
    </>
  );
  return to ? (
    <Link to={to} className={`${styles.stat} ${styles.statLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.stat}>{body}</div>
  );
}
