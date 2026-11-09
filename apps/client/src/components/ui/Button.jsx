import { forwardRef } from 'react';
import { Link } from 'react-router';
import styles from './Button.module.css';
import { Spinner } from './Feedback.jsx';

/**
 * Button with variants (primary, secondary, ghost, danger, link) and a loading
 * state that disables it, which blocks double submits (SB1/US43).
 * Pass `to` to render a router link styled as a button.
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    fullWidth = false,
    to,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = [styles.button, styles[variant], styles[size], fullWidth ? styles.full : '', className]
    .filter(Boolean)
    .join(' ');
  const content = (
    <>
      {loading ? (
        <Spinner size="sm" tone={variant === 'primary' || variant === 'danger' ? 'inverse' : 'primary'} />
      ) : null}
      {!loading && LeftIcon ? <LeftIcon size={size === 'sm' ? 16 : 18} aria-hidden="true" /> : null}
      <span>{children}</span>
      {RightIcon ? <RightIcon size={size === 'sm' ? 16 : 18} aria-hidden="true" /> : null}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export function IconButton({ icon: Icon, label, size = 'md', variant = 'ghost', className = '', ...rest }) {
  return (
    <button
      type="button"
      className={[styles.iconButton, styles[`icon-${variant}`], styles[`icon-${size}`], className].join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 20} aria-hidden="true" />
    </button>
  );
}
