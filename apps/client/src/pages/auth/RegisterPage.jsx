import { Link, useNavigate } from 'react-router';
import { Mail, UserRound, Globe2, UserPlus } from 'lucide-react';
import { registerSchema } from '@skillbridge/shared';
import { Button, TextInput, PasswordInput, PasswordChecklist, FormErrorSummary } from '../../components/ui/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/misc.js';
import { browserTimeZone } from '../../utils/format.js';
import styles from './AuthPages.module.css';

const LABELS = { name: 'Full name', email: 'Email', password: 'Password', confirmPassword: 'Confirm password' };

/**
 * SB1/US1 (register with email), US2 (secure password), US8 (validation),
 * US9 (already-registered email), US15 (clear interface).
 */
export default function RegisterPage() {
  useDocumentTitle('Create your account');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const timezone = browserTimeZone();

  const form = useForm({
    initialValues: { name: '', email: '', password: '', confirmPassword: '', timezone },
    schema: registerSchema,
    onSubmit: async (values) => {
      const user = await register(values);
      toast.success('Your account is ready. Let’s set up your profile.', {
        title: `Welcome, ${user.name.split(' ')[0]}!`,
      });
      navigate('/dashboard', { replace: true });
    },
  });

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join peers who teach what they know and learn what they need.</p>
      </div>
      <form className={styles.form} onSubmit={form.handleSubmit} noValidate aria-label="Create account">
        <FormErrorSummary ref={form.summaryRef} errors={form.errors} formError={form.formError} labels={LABELS} />
        <TextInput label="Full name" autoComplete="name" leftIcon={UserRound} required {...form.field('name')} />
        <TextInput label="Email" type="email" autoComplete="email" leftIcon={Mail} required {...form.field('email')} />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          required
          aria-describedby="password-rules"
          {...form.field('password')}
        />
        <PasswordChecklist password={form.values.password} />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          required
          {...form.field('confirmPassword')}
        />
        <p className={styles.tzNote}>
          <Globe2 size={14} aria-hidden="true" /> Time zone detected: {timezone}. You can change it later.
        </p>
        <Button type="submit" size="lg" fullWidth loading={form.submitting} leftIcon={UserPlus}>
          Create account
        </Button>
      </form>
      <p className={styles.footer}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </>
  );
}
