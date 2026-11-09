import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Mail, MailCheck, KeyRound, ArrowLeft } from 'lucide-react';
import { forgotPasswordSchema, resetPasswordSchema } from '@skillbridge/shared';
import {
  Button,
  TextInput,
  PasswordInput,
  PasswordChecklist,
  FormErrorSummary,
  Alert,
} from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/misc.js';
import { authApi } from '../../features/api.js';
import styles from './AuthPages.module.css';

/** SB1/US5 – request a reset link. The answer is the same whether or not the email exists. */
export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const [sentTo, setSentTo] = useState(null);
  const form = useForm({
    initialValues: { email: '' },
    schema: forgotPasswordSchema,
    onSubmit: async ({ email }) => {
      await authApi.forgotPassword(email);
      setSentTo(email);
    },
  });

  if (sentTo) {
    return (
      <div role="status">
        <span className={styles.successIcon}>
          <MailCheck size={28} aria-hidden="true" />
        </span>
        <h1 className={styles.title}>Check your inbox</h1>
        <p className={styles.subtitle}>
          If an account exists for <strong>{sentTo}</strong>, we’ve sent a link to reset your password. It works once
          and expires in 30 minutes.
        </p>
        {import.meta.env.DEV ? (
          <Alert tone="info" title="Running locally?" className={styles.devNote}>
            Open Mailpit at{' '}
            <a href="http://localhost:8025" target="_blank" rel="noreferrer">
              localhost:8025
            </a>
            . If Mailpit isn’t running, the link is printed in the API terminal.
          </Alert>
        ) : null}
        <p className={styles.footer}>
          <Link to="/login">
            <ArrowLeft size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> Back to log
            in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Forgot your password?</h1>
        <p className={styles.subtitle}>Enter your email and we’ll send you a link to choose a new one.</p>
      </div>
      <form className={styles.form} onSubmit={form.handleSubmit} noValidate aria-label="Request password reset">
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{ email: 'Email' }}
        />
        <TextInput label="Email" type="email" autoComplete="email" leftIcon={Mail} required {...form.field('email')} />
        <Button type="submit" size="lg" fullWidth loading={form.submitting}>
          Send reset link
        </Button>
      </form>
      <p className={styles.footer}>
        Remembered it? <Link to="/login">Back to log in</Link>
      </p>
    </>
  );
}

/** SB1/US6 – choose a new password from the emailed link. */
export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [expired, setExpired] = useState(false);

  const form = useForm({
    initialValues: { token: token ?? '', password: '', confirmPassword: '' },
    schema: resetPasswordSchema,
    onSubmit: async (values) => {
      try {
        await authApi.resetPassword(values);
      } catch (err) {
        if (err.code === 'RESET_TOKEN_INVALID' || err.fields?.token) {
          setExpired(true);
          return;
        }
        throw err;
      }
      toast.success('Your password has been updated.');
      navigate('/login?reset=success', { replace: true });
    },
  });

  if (expired) {
    return (
      <div>
        <h1 className={styles.title}>This link has expired</h1>
        <p className={styles.subtitle}>Reset links work once and only for 30 minutes. Request a new one to continue.</p>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <Button to="/forgot-password" size="lg" fullWidth>
            Request a new link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.subtitle}>
          You’ll be signed out on every device, then you can log in with the new password.
        </p>
      </div>
      <form className={styles.form} onSubmit={form.handleSubmit} noValidate aria-label="Reset password">
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{ password: 'New password', confirmPassword: 'Confirm password', token: 'Reset link' }}
        />
        <PasswordInput label="New password" autoComplete="new-password" required {...form.field('password')} />
        <PasswordChecklist password={form.values.password} />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          required
          {...form.field('confirmPassword')}
        />
        <Button type="submit" size="lg" fullWidth loading={form.submitting} leftIcon={KeyRound}>
          Update password
        </Button>
      </form>
    </>
  );
}
