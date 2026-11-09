import { useCallback, useRef, useState } from 'react';
import { toFieldErrors } from '@skillbridge/shared';

/**
 * Form state + validation with the SAME Zod schema the API uses (SB1/US8, US41).
 * - Field errors appear on blur and on submit.
 * - Server field errors (422/409) are shown on the matching fields.
 * - After a failed submit, the error summary receives focus.
 */
export function useForm({ initialValues, schema, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef(null);

  const validate = useCallback(
    (vals) => {
      if (!schema) return {};
      const result = schema.safeParse(vals);
      return result.success ? {} : toFieldErrors(result.error);
    },
    [schema],
  );

  const setField = useCallback(
    (name, value) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // Re-validate a field the user already left, so the message clears as soon as it is fixed.
        if (touched[name]) {
          const all = validate(next);
          setErrors((e) => ({ ...e, [name]: all[name] }));
        }
        return next;
      });
    },
    [touched, validate],
  );

  const handleChange = useCallback(
    (e) => {
      const { name, type, checked, value } = e.target;
      setField(name, type === 'checkbox' ? checked : value);
    },
    [setField],
  );

  const handleBlur = useCallback(
    (e) => {
      const { name } = e.target;
      setTouched((t) => ({ ...t, [name]: true }));
      const all = validate(values);
      setErrors((prev) => ({ ...prev, [name]: all[name] }));
    },
    [validate, values],
  );

  const focusSummary = () => requestAnimationFrame(() => summaryRef.current?.focus());

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      setFormError(null);
      const all = validate(values);
      setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])));
      if (Object.keys(all).length > 0) {
        setErrors(all);
        focusSummary();
        return;
      }
      setErrors({});
      setSubmitting(true);
      try {
        const parsed = schema ? schema.parse(values) : values;
        await onSubmit(parsed, { setErrors, setFormError, setValues });
      } catch (err) {
        if (err?.fields) setErrors(err.fields);
        setFormError(err?.fields ? null : (err?.message ?? 'Something went wrong. Please try again.'));
        focusSummary();
      } finally {
        setSubmitting(false);
      }
    },
    [validate, values, schema, onSubmit],
  );

  /** Props for a field: value, onChange, onBlur, error and name. */
  const field = useCallback(
    (name) => ({
      name,
      value: values[name] ?? '',
      onChange: handleChange,
      onBlur: handleBlur,
      error: errors[name],
    }),
    [values, errors, handleChange, handleBlur],
  );

  return {
    values,
    errors,
    formError,
    submitting,
    summaryRef,
    field,
    setField,
    setValues,
    setErrors,
    setFormError,
    handleChange,
    handleBlur,
    handleSubmit,
  };
}
