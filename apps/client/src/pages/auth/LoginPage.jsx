import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Mail, LogIn } from 'lucide-react';
import { loginSchema } from '@skillbridge/shared';
import { Button, TextInput, PasswordInput, FormErrorSummary, ConfirmDialog, Alert } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/misc.js';
import { safeNext } from '../../routes/guards.jsx';
import styles from './AuthPages.module.css';

/** SB1/US3 (log in), SB1/US15 (clear interface), SB1/US32 (reactivate a self-deactivated account). */
export default function LoginPage() {
  useDocumentTitle('Log in');
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [reactivatePrompt, setReactivatePrompt] = useState(null);
  const [reactivating, setReactivating] = useState(false);
  const next = safeNext(params.get('next')) ?? '/dashboard';

  const form = useForm({
    initialValues: { email: '', password: '' },
    schema: loginSchema,
    onSubmit: async (values) => {
      try {
        const user = await login(values);
        toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
        navigate(next, { replace: true });
      } catch (err) {
        if (err.code === 'ACCOUNT_DEACTIVATED' && err.details?.canReactivate) {
          setReactivatePrompt(values);
          return;
        }
        throw err; // shown in the error summary by useForm
      }
    },
  });

  async function reactivate() {
    setReactivating(true);
    try {
      const user = await login({ ...reactivatePrompt, reactivate: true });
      toast.success(`Welcome back, ${user.name.split(' ')[0]}! Your account is active again.`);
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReactivating(false);
      setReactivatePrompt(null);
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Log in to continue learning and teaching.</p>
      </div>
      {params.get('reset') === 'success' ? (
        <Alert tone="success" title="Password updated">
          Log in with your new password.
        </Alert>
      ) : null}
      <form className={styles.form} onSubmit={form.handleSubmit} noValidate aria-label="Log in">
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{ email: 'Email', password: 'Password' }}
        />
        <TextInput label="Email" type="email" autoComplete="email" leftIcon={Mail} required {...form.field('email')} />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          required
          labelAction={
            <Link to="/forgot-password" className={styles.smallLink}>
              Forgot password?
            </Link>
          }
          {...form.field('password')}
        />
        <Button type="submit" size="lg" fullWidth loading={form.submitting} leftIcon={LogIn}>
          Log in
        </Button>
      </form>
      <p className={styles.footer}>
        New to SkillBridge? <Link to="/register">Create an account</Link>
      </p>

      <ConfirmDialog
        open={Boolean(reactivatePrompt)}
        tone="primary"
        title="Reactivate your account?"
        message="You deactivated this account earlier. Reactivating makes your profile visible again and lets you use SkillBridge as before."
        confirmLabel="Reactivate and log in"
        busy={reactivating}
        onConfirm={reactivate}
        onCancel={() => setReactivatePrompt(null)}
      />
    </>
  );
}
