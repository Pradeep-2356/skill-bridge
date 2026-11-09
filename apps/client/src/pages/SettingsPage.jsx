import { useState } from 'react';
import { useNavigate } from 'react-router';
import { KeyRound, PauseCircle, Trash2 } from 'lucide-react';
import { changePasswordSchema } from '@skillbridge/shared';
import {
  PageHeader,
  Card,
  Button,
  PasswordInput,
  PasswordChecklist,
  FormErrorSummary,
  ConfirmDialog,
} from '../components/ui/index.js';
import { authApi, profileApi } from '../features/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useForm } from '../hooks/useForm.js';
import { useDocumentTitle } from '../hooks/misc.js';
import { formatDate } from '../utils/format.js';
import page from './Page.module.css';

/** SB1/US7 – change password while signed in. */
function ChangePasswordCard() {
  const toast = useToast();
  const form = useForm({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    schema: changePasswordSchema,
    onSubmit: async (values, { setValues }) => {
      await authApi.changePassword(values);
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other devices have been signed out.');
    },
  });
  return (
    <Card title="Change password" subtitle="You’ll stay signed in here; every other device is signed out.">
      <form
        onSubmit={form.handleSubmit}
        noValidate
        className={page.stack}
        style={{ gap: 'var(--space-4)', maxWidth: 520 }}
        aria-label="Change password"
      >
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{
            currentPassword: 'Current password',
            newPassword: 'New password',
            confirmPassword: 'Confirm new password',
          }}
        />
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          required
          {...form.field('currentPassword')}
        />
        <PasswordInput label="New password" autoComplete="new-password" required {...form.field('newPassword')} />
        <PasswordChecklist password={form.values.newPassword} id="new-password-rules" />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          required
          {...form.field('confirmPassword')}
        />
        <div>
          <Button type="submit" leftIcon={KeyRound} loading={form.submitting}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Password field used inside the deactivate/delete confirmations. */
function ConfirmPassword({ value, onChange, error }) {
  return (
    <PasswordInput
      name="confirm-password"
      label="Your password"
      autoComplete="current-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
    />
  );
}

/** SB1/US32 (deactivate), US33 (delete), US34 (confirm before deleting). */
export default function SettingsPage() {
  useDocumentTitle('Account settings');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null); // 'deactivate' | 'delete'
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function open(kind) {
    setPassword('');
    setError(null);
    setDialog(kind);
  }

  async function confirm() {
    if (!password) {
      setError('Enter your password to confirm');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'deactivate') {
        await profileApi.deactivate(password);
        toast.success('Your account is deactivated. Log in any time to reactivate it.');
      } else {
        await profileApi.deleteAccount({ password, confirmText: 'DELETE' });
        toast.success('Your account and profile have been permanently deleted.');
      }
      setDialog(null);
      setUser(null, { reason: 'left' });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.fields?.password ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Account settings" subtitle="Security and account controls." />
      <div className={page.stack}>
        <Card title="Account">
          <dl className={page.definition}>
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt, user.timezone)}</dd>
          </dl>
        </Card>

        <ChangePasswordCard />

        <Card title="Deactivate account">
          <div className={page.settingRow}>
            <p className={page.settingText}>
              Hide your profile and pause SkillBridge. Your skills and settings are kept, and you can come back any time
              by logging in again.
            </p>
            <Button variant="secondary" leftIcon={PauseCircle} onClick={() => open('deactivate')}>
              Deactivate account
            </Button>
          </div>
        </Card>

        <Card title="Delete account" className={page.dangerCard}>
          <div className={page.settingRow}>
            <p className={page.settingText}>
              Permanently delete your account, profile, skills and photo. Other members will see past sessions with “a
              former member”. <strong>This cannot be undone.</strong>
            </p>
            <Button variant="danger" leftIcon={Trash2} onClick={() => open('delete')}>
              Delete account
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={dialog === 'deactivate'}
        tone="primary"
        title="Deactivate your account?"
        message="Your profile will be hidden and you’ll be signed out. Log in again whenever you want to reactivate it."
        confirmLabel="Deactivate"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      >
        <ConfirmPassword value={password} onChange={setPassword} error={error} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        title="Delete your account permanently?"
        message="This removes your account, profile, skills and photo for good. It cannot be undone."
        confirmLabel="Delete my account"
        requireText="DELETE"
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setDialog(null)}
      >
        <ConfirmPassword value={password} onChange={setPassword} error={error} />
      </ConfirmDialog>
    </>
  );
}
