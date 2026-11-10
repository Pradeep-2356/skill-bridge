import { useNavigate, useParams } from 'react-router';
import { Eye, Pencil, Info, UserX } from 'lucide-react';
import { LIMITS, profileUpdateSchema } from '@skillbridge/shared';
import {
  PageHeader,
  Button,
  Card,
  TextInput,
  TextArea,
  FormErrorSummary,
  Skeleton,
  ErrorState,
  EmptyState,
  Alert,
} from '../../components/ui/index.js';
import { ProfileView } from '../../features/profile/ProfileView.jsx';
import { AvatarUploader } from '../../features/profile/AvatarUploader.jsx';
import { InterestPicker } from '../../features/profile/InterestPicker.jsx';
import { TimezoneSelect } from '../../features/availability/TimezoneSelect.jsx';
import { profileApi, skillsApi } from '../../features/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/misc.js';
import page from '../Page.module.css';

function ProfileSkeleton() {
  return (
    <div className={page.stack} aria-busy="true">
      <Skeleton height={150} radius="var(--radius-lg)" />
      <div className={page.grid2}>
        <Skeleton height={220} radius="var(--radius-lg)" />
        <Skeleton height={220} radius="var(--radius-lg)" />
      </div>
    </div>
  );
}

/** SB1/US30 – view my complete profile (including private account details). */
export function MyProfilePage() {
  useDocumentTitle('My profile');
  const { data, loading, error, reload } = useApi(() => profileApi.me(), []);
  const user = data?.user;
  return (
    <>
      <PageHeader
        title="My profile"
        subtitle="Everything other members can see about you, plus your private account details."
        actions={
          <>
            <Button variant="secondary" leftIcon={Eye} to="/profile/preview">
              Preview as others see it
            </Button>
            <Button leftIcon={Pencil} to="/profile/edit">
              Edit profile
            </Button>
          </>
        }
      />
      {loading ? <ProfileSkeleton /> : null}
      {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
      {user ? (
        <div className={page.stack}>
          <Card title="Private account details" subtitle="Only you and SkillBridge administrators can see these.">
            <dl className={page.definition}>
              <dt>Email</dt>
              <dd>{user.email}</dd>
              <dt>Account status</dt>
              <dd>{user.status === 'active' ? 'Active' : 'Deactivated'}</dd>
              <dt>Role</dt>
              <dd>{user.role === 'admin' ? 'Administrator' : 'Member'}</dd>
            </dl>
          </Card>
          <ProfileView profile={user} emptyHints />
        </div>
      ) : null}
    </>
  );
}

/** SB1/US31 – my profile exactly as another member sees it. */
export function ProfilePreviewPage() {
  useDocumentTitle('Profile preview');
  const { data, loading, error, reload } = useApi(() => profileApi.preview(), []);
  return (
    <>
      <PageHeader
        title="Profile preview"
        subtitle="This is exactly what other members see."
        backTo="/profile"
        backLabel="Back to my profile"
      />
      <Alert tone="info" title="Viewing as another member">
        Your email, role and account status are never shown to other members.
      </Alert>
      <div style={{ marginTop: 'var(--space-6)' }}>
        {loading ? <ProfileSkeleton /> : null}
        {error ? <ErrorState message={error.message} onRetry={reload} /> : null}
        {data?.profile ? <ProfileView profile={data.profile} /> : null}
      </div>
    </>
  );
}

/** Another member's public profile (SB1/US46 – public fields only). */
export function PublicProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => profileApi.publicProfile(id), [id]);
  useDocumentTitle(data?.profile?.name ?? 'Profile');
  const isMe = user?.id === id;
  return (
    <>
      <PageHeader title={data?.profile?.name ?? 'Member profile'} backTo="/discover" backLabel="Back to discovery" />
      {isMe ? (
        <Alert tone="info" title="This is your own profile">
          <Button variant="link" to="/profile/edit">
            Edit your profile
          </Button>
        </Alert>
      ) : null}
      <div style={{ marginTop: isMe ? 'var(--space-6)' : 0 }}>
        {loading ? <ProfileSkeleton /> : null}
        {error?.status === 404 ? (
          <EmptyState
            icon={UserX}
            title="Profile not available"
            description="This member may have deactivated or deleted their account."
            action={<Button to="/discover">Find other mentors</Button>}
          />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : null}
        {data?.profile ? <ProfileView profile={data.profile} /> : null}
      </div>
    </>
  );
}

/** SB1/US16 (name and info), US17 (photo), US18 (bio), US19 (interests), US29 (time zone). */
export function EditProfilePage() {
  useDocumentTitle('Edit profile');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const categories = useApi(() => skillsApi.categories(), []);

  const form = useForm({
    initialValues: {
      name: user.name,
      headline: user.headline ?? '',
      bio: user.bio ?? '',
      timezone: user.timezone,
      learningInterests: (user.learningInterests ?? []).map((c) => c.id),
    },
    schema: profileUpdateSchema,
    onSubmit: async (values) => {
      const { data } = await profileApi.update(values);
      setUser(data.user);
      toast.success('Your profile has been saved.');
      navigate('/profile');
    },
  });

  return (
    <>
      <PageHeader
        title="Edit profile"
        subtitle="Help learners and mentors get to know you."
        backTo="/profile"
        backLabel="Back to my profile"
      />
      <div className={page.stack}>
        <Card>
          <AvatarUploader
            name={user.name}
            avatarUrl={user.avatarUrl}
            onChange={(avatarUrl) => setUser({ ...user, avatarUrl })}
          />
        </Card>
        <Card title="Profile details">
          <form onSubmit={form.handleSubmit} noValidate className={page.stack} aria-label="Edit profile">
            <FormErrorSummary
              ref={form.summaryRef}
              errors={form.errors}
              formError={form.formError}
              labels={{
                name: 'Full name',
                headline: 'Headline',
                bio: 'Bio',
                timezone: 'Time zone',
                learningInterests: 'Learning interests',
              }}
            />
            <div className={page.formGrid}>
              <TextInput
                label="Full name"
                required
                autoComplete="name"
                maxLength={LIMITS.NAME_MAX}
                {...form.field('name')}
              />
              <TextInput
                label="Headline"
                placeholder="e.g. Frontend developer who loves teaching CSS"
                maxLength={LIMITS.HEADLINE_MAX}
                hint="One line shown under your name."
                {...form.field('headline')}
              />
              <div className={page.full}>
                <TextArea
                  label="Bio"
                  rows={5}
                  maxLength={LIMITS.BIO_MAX}
                  placeholder="Tell people about your background, what you enjoy teaching and what you want to learn."
                  {...form.field('bio')}
                />
              </div>
              <div className={page.full}>
                <TimezoneSelect
                  value={form.values.timezone}
                  onChange={(tz) => form.setField('timezone', tz)}
                  error={form.errors.timezone}
                />
              </div>
              <div className={page.full}>
                {categories.loading ? (
                  <Skeleton height={80} />
                ) : categories.error ? (
                  <ErrorState compact message={categories.error.message} onRetry={categories.reload} />
                ) : (
                  <InterestPicker
                    categories={categories.data?.categories ?? []}
                    value={form.values.learningInterests}
                    onChange={(ids) => form.setField('learningInterests', ids)}
                    error={form.errors.learningInterests}
                  />
                )}
              </div>
            </div>
            <Alert tone="info">
              <Info size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> Skills and
              availability have their own pages in the sidebar.
            </Alert>
            <div className={page.formActions}>
              <Button variant="secondary" to="/profile">
                Cancel
              </Button>
              <Button type="submit" loading={form.submitting}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
