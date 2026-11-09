import { forwardRef, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import { PASSWORD_RULES, passwordStrength } from '@skillbridge/shared';
import styles from './Form.module.css';

/** Wires label, hint and error to the control with aria attributes (SB1/US41). */
function useFieldIds(id, name) {
  const generated = useId();
  const fieldId = id ?? `field-${name ?? generated.replace(/:/g, '')}`;
  return { fieldId, hintId: `${fieldId}-hint`, errorId: `${fieldId}-error` };
}

function describedBy(hint, error, hintId, errorId) {
  return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
}

export function FieldShell({ fieldId, label, hint, error, required, hintId, errorId, children, labelAction, counter }) {
  return (
    <div className={styles.field}>
      {label ? (
        <div className={styles.labelRow}>
          <label htmlFor={fieldId} className={styles.label}>
            {label}
            {required ? (
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          {labelAction}
        </div>
      ) : null}
      {children}
      <div className={styles.metaRow}>
        <div>
          {error ? (
            <p id={errorId} className={styles.error}>
              <AlertCircle size={14} aria-hidden="true" />
              {error}
            </p>
          ) : hint ? (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          ) : null}
        </div>
        {counter}
      </div>
    </div>
  );
}

export const TextInput = forwardRef(function TextInput(
  { id, name, label, hint, error, required, labelAction, className = '', leftIcon: LeftIcon, rightSlot, ...rest },
  ref,
) {
  const ids = useFieldIds(id, name);
  return (
    <FieldShell {...ids} label={label} hint={hint} error={error} required={required} labelAction={labelAction}>
      <div className={styles.inputWrap}>
        {LeftIcon ? <LeftIcon size={18} className={styles.leftIcon} aria-hidden="true" /> : null}
        <input
          ref={ref}
          id={ids.fieldId}
          name={name}
          className={`${styles.input} ${LeftIcon ? styles.withLeftIcon : ''} ${rightSlot ? styles.withRightSlot : ''} ${error ? styles.invalid : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId)}
          aria-required={required || undefined}
          {...rest}
        />
        {rightSlot ? <div className={styles.rightSlot}>{rightSlot}</div> : null}
      </div>
    </FieldShell>
  );
});

export const TextArea = forwardRef(function TextArea(
  { id, name, label, hint, error, required, maxLength, value = '', rows = 4, ...rest },
  ref,
) {
  const ids = useFieldIds(id, name);
  const near = maxLength && value.length > maxLength * 0.9;
  return (
    <FieldShell
      {...ids}
      label={label}
      hint={hint}
      error={error}
      required={required}
      counter={
        maxLength ? (
          <span className={`${styles.counter} ${near ? styles.counterNear : ''}`} aria-live="polite">
            {value.length}/{maxLength}
          </span>
        ) : null
      }
    >
      <textarea
        ref={ref}
        id={ids.fieldId}
        name={name}
        rows={rows}
        value={value}
        maxLength={maxLength}
        className={`${styles.input} ${styles.textarea} ${error ? styles.invalid : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId)}
        {...rest}
      />
    </FieldShell>
  );
});

export const Select = forwardRef(function Select(
  { id, name, label, hint, error, required, options = [], placeholder, groups, ...rest },
  ref,
) {
  const ids = useFieldIds(id, name);
  return (
    <FieldShell {...ids} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={ids.fieldId}
        name={name}
        className={`${styles.input} ${styles.select} ${error ? styles.invalid : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hint, error, ids.hintId, ids.errorId)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {groups
          ? groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
      </select>
    </FieldShell>
  );
});

/** Password field with a show/hide toggle. */
export const PasswordInput = forwardRef(function PasswordInput({ id, name, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const ids = useFieldIds(id, name);
  return (
    <TextInput
      ref={ref}
      id={ids.fieldId}
      name={name}
      type={visible ? 'text' : 'password'}
      rightSlot={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={ids.fieldId}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  );
});

const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/** Live strength meter + rule checklist under a new-password field (SB1/US2). */
export function PasswordChecklist({ password = '', id = 'password-rules' }) {
  const score = passwordStrength(password);
  return (
    <div className={styles.checklist} id={id}>
      <div className={styles.meter} aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`${styles.meterBar} ${score >= n ? styles[`strength${score}`] : ''}`} />
        ))}
      </div>
      <p className={styles.meterLabel} aria-live="polite">
        {password ? `Password strength: ${STRENGTH[score]}` : 'Your password needs:'}
      </p>
      <ul role="list" className={styles.rules}>
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.id} className={ok ? styles.ruleOk : styles.rule}>
              {ok ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
              {rule.label}
              <span className="sr-only">{ok ? ' – done' : ' – missing'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Checkbox({ id, name, label, checked, onChange, hint }) {
  const ids = useFieldIds(id, name);
  return (
    <div className={styles.checkboxRow}>
      <input
        id={ids.fieldId}
        name={name}
        type="checkbox"
        className={styles.checkbox}
        checked={checked}
        onChange={onChange}
        aria-describedby={hint ? ids.hintId : undefined}
      />
      <div>
        <label htmlFor={ids.fieldId} className={styles.checkboxLabel}>
          {label}
        </label>
        {hint ? (
          <p id={ids.hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Error summary at the top of a form. It receives focus after a failed submit
 * so screen-reader and keyboard users hear what to fix (Stage 3 accessibility).
 */
export const FormErrorSummary = forwardRef(function FormErrorSummary(
  { errors = {}, formError, labels = {}, idPrefix = 'field-' },
  ref,
) {
  const entries = Object.entries(errors).filter(([, msg]) => Boolean(msg));
  if (!formError && entries.length === 0) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className={styles.summary}>
      <AlertCircle size={18} aria-hidden="true" className={styles.summaryIcon} />
      <div>
        <p className={styles.summaryTitle}>
          {formError ?? (entries.length === 1 ? 'Please fix 1 problem:' : `Please fix ${entries.length} problems:`)}
        </p>
        {entries.length > 0 ? (
          <ul className={styles.summaryList}>
            {entries.map(([field, message]) =>
              field === '_form' ? (
                <li key={field}>{message}</li>
              ) : (
                <li key={field}>
                  <a href={`#${idPrefix}${field}`}>
                    {labels[field] ? `${labels[field]}: ` : ''}
                    {message}
                  </a>
                </li>
              ),
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
});
