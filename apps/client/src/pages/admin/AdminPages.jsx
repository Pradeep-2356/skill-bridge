import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Search, Users, UserCheck, UserX, ShieldCheck, Ban, RotateCcw } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import {
  PageHeader,
  Card,
  Avatar,
  Badge,
  Button,
  Select,
  TextArea,
  Modal,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Skeleton,
  Pagination,
  StatCard,
  SkillChip,
  Alert,
} from '../../components/ui/index.js';
import { adminApi } from '../../features/api.js';
import { useApi } from '../../hooks/useApi.js';
import { useDebounce, useDocumentTitle } from '../../hooks/misc.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, formatDateTime } from '../../utils/format.js';
import page from '../Page.module.css';
import styles from './Admin.module.css';

function StatusBadge({ status }) {
  return status === 'active' ? (
    <Badge tone="success" icon={UserCheck}>
      Active
    </Badge>
  ) : (
    <Badge tone="danger" icon={UserX}>
      Deactivated
    </Badge>
  );
}

function RoleBadge({ role }) {
  return role === 'admin' ? (
    <Badge tone="primary" icon={ShieldCheck}>
      Admin
    </Badge>
  ) : (
    <Badge tone="neutral">Member</Badge>
  );
}

/** SB1/US47 – view registered users, with search and filters. */
export function AdminUsersPage() {
  useDocumentTitle('Manage users');
  const { user: me } = useAuth();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const q = useDebounce(text.trim(), 300);
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const pageNo = Math.max(1, Number(params.get('page')) || 1);

  const { data, meta, loading, error, reload } = useApi(
    () =>
      adminApi.users({
        q: q || undefined,
        status: status || undefined,
        role: role || undefined,
        page: pageNo,
        limit: 15,
      }),
    [q, status, role, pageNo],
  );

  function update(key, value) {
    const next = Object.fromEntries(params.entries());
    if (value) next[key] = value;
    else delete next[key];
    delete next.page;
    setParams(next);
  }

  return (
    <>
      <PageHeader title="Manage users" subtitle="Monitor the community and help with account problems." />
      {meta?.totals ? (
        <div className={page.grid3} style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard icon={Users} label="Total accounts" value={meta.totals.active + meta.totals.deactivated} />
          <StatCard icon={UserCheck} tone="teach" label="Active" value={meta.totals.active} />
          <StatCard icon={UserX} tone="learn" label="Deactivated" value={meta.totals.deactivated} />
        </div>
      ) : null}
      <Card padded={false}>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <label htmlFor="admin-search" className="sr-only">
              Search by name or email
            </label>
            <Search size={18} className={styles.searchIcon} aria-hidden="true" />
            <input
              id="admin-search"
              type="search"
              className={styles.search}
              placeholder="Search by name or email"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (params.get('page')) update('page', '');
              }}
            />
          </div>
          <Select
            name="status"
            label="Status"
            value={status}
            onChange={(e) => update('status', e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'deactivated', label: 'Deactivated' },
            ]}
          />
          <Select
            name="role"
            label="Role"
            value={role}
            onChange={(e) => update('role', e.target.value)}
            options={[
              { value: '', label: 'All roles' },
              { value: 'user', label: 'Members' },
              { value: 'admin', label: 'Admins' },
            ]}
          />
        </div>
        {loading && !data ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <Skeleton height={44} count={6} gap={10} />
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <ErrorState message={error.message} onRetry={reload} />
          </div>
        ) : data.users.length === 0 ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <EmptyState
              icon={Users}
              title="No users match these filters"
              description="Try a different name, email or filter."
            />
          </div>
        ) : (
          <div className={styles.tableWrap} aria-busy={loading}>
            <table className={styles.table}>
              <caption className="sr-only">Registered users, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Skills</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last login</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className={styles.userCell}>
                        <Avatar name={u.name} src={u.avatarUrl} size={36} />
                        <div>
                          <Link to={`/admin/users/${u.id}`} className={styles.userLink}>
                            {u.name}
                            {u.id === me.id ? <span className="text-muted"> (you)</span> : null}
                          </Link>
                          <p className={styles.email}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                    </td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className={styles.numbers}>
                      <span title="Teaching">{u.teachSkillsCount} teach</span> ·{' '}
                      <span title="Learning">{u.learnSkillsCount} learn</span>
                    </td>
                    <td>{formatDate(u.createdAt, me.timezone)}</td>
                    <td>
                      {u.lastLoginAt ? (
                        formatDate(u.lastLoginAt, me.timezone)
                      ) : (
                        <span className="text-muted">Never</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {meta ? (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onChange={(p) => setParams({ ...Object.fromEntries(params.entries()), page: String(p) })}
          label="User list pages"
        />
      ) : null}
    </>
  );
}

/** SB1/US49 (view details) and US48 (deactivate an inappropriate account). */
export function AdminUserDetailPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useApi(() => adminApi.user(id), [id]);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [busy, setBusy] = useState(false);
  const u = data?.user;
  useDocumentTitle(u ? `${u.name} · Admin` : 'User details');

  async function change(status) {
    if (status === 'deactivated' && reason.trim().length < 5) {
      setReasonError('Give a reason of at least 5 characters');
      return;
    }
    setBusy(true);
    try {
      const { data: result } = await adminApi.setStatus(
        id,
        status === 'deactivated' ? { status, reason: reason.trim() } : { status },
      );
      setData({ user: result.user });
      toast.success(
        status === 'deactivated' ? `${u.name}’s account has been deactivated.` : `${u.name}’s account is active again.`,
      );
      setDialog(null);
      setReason('');
    } catch (err) {
      if (err.fields?.reason) setReasonError(err.fields.reason);
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={u?.name ?? 'User details'} backTo="/admin/users" backLabel="All users" />
      {loading ? <Skeleton height={320} radius="var(--radius-lg)" /> : null}
      {error ? (
        <ErrorState
          message={error.status === 404 ? 'This user no longer exists.' : error.message}
          onRetry={error.status === 404 ? undefined : reload}
        />
      ) : null}
      {u ? (
        <div className={page.stack}>
          <Card>
            <div className={styles.detailHeader}>
              <Avatar name={u.name} src={u.avatarUrl} size={72} />
              <div className={styles.detailWho}>
                <h2 className={styles.detailName}>{u.name}</h2>
                <p className={styles.email}>{u.email}</p>
                <div className={page.chips} style={{ marginTop: 'var(--space-2)' }}>
                  <RoleBadge role={u.role} />
                  <StatusBadge status={u.status} />
                </div>
              </div>
              {u.id !== me.id ? (
                u.status === 'active' ? (
                  <Button variant="danger" leftIcon={Ban} onClick={() => setDialog('deactivate')}>
                    Deactivate account
                  </Button>
                ) : (
                  <Button variant="secondary" leftIcon={RotateCcw} onClick={() => setDialog('reactivate')}>
                    Reactivate account
                  </Button>
                )
              ) : (
                <Badge tone="neutral">This is your account</Badge>
              )}
            </div>
          </Card>

          {u.deactivation ? (
            <Alert
              tone="danger"
              title={u.deactivation.by === 'admin' ? 'Deactivated by an administrator' : 'Deactivated by the user'}
            >
              {u.deactivation.reason ? `Reason: ${u.deactivation.reason}. ` : ''}
              On {formatDateTime(u.deactivation.at, me.timezone)}.
            </Alert>
          ) : null}

          <div className={page.grid2}>
            <Card title="Account details" subtitle="For troubleshooting. Passwords are never visible.">
              <dl className={page.definition}>
                <dt>User ID</dt>
                <dd>
                  <code>{u.id}</code>
                </dd>
                <dt>Joined</dt>
                <dd>{formatDateTime(u.createdAt, me.timezone)}</dd>
                <dt>Last login</dt>
                <dd>{u.lastLoginAt ? formatDateTime(u.lastLoginAt, me.timezone) : 'Never'}</dd>
                <dt>Last updated</dt>
                <dd>{formatDateTime(u.updatedAt, me.timezone)}</dd>
                <dt>Time zone</dt>
                <dd>{u.timezone}</dd>
                <dt>Availability</dt>
                <dd>{u.availabilitySlots} weekly ranges</dd>
                <dt>Sessions</dt>
                <dd>{u.sessionsCount}</dd>
              </dl>
            </Card>
            <Card title="Profile">
              <div className={page.stack} style={{ gap: 'var(--space-4)' }}>
                <div>
                  <p className={page.subheading}>Headline</p>
                  <p>{u.headline || <span className="text-muted">None</span>}</p>
                </div>
                <div>
                  <p className={page.subheading}>Bio</p>
                  <p style={{ whiteSpace: 'pre-line' }}>{u.bio || <span className="text-muted">None</span>}</p>
                </div>
                <div>
                  <p className={page.subheading}>Teaches</p>
                  <div className={page.chips}>
                    {u.teachSkills.length ? (
                      u.teachSkills.map((t) => (
                        <SkillChip key={t.id} kind="teach" name={t.skill?.name} level={t.proficiency} />
                      ))
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className={page.subheading}>Learning</p>
                  <div className={page.chips}>
                    {u.learnSkills.length ? (
                      u.learnSkills.map((l) => (
                        <SkillChip key={l.id} kind="learn" name={l.skill?.name} level={l.preferredLevel} />
                      ))
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <Modal
        open={dialog === 'deactivate'}
        onClose={busy ? undefined : () => setDialog(null)}
        title={`Deactivate ${u?.name ?? 'this account'}?`}
        description="They will be signed out immediately, cannot log in, and disappear from search."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => change('deactivated')}>
              Deactivate
            </Button>
          </>
        }
      >
        <TextArea
          name="reason"
          label="Reason (recorded for other admins)"
          required
          rows={3}
          maxLength={LIMITS.DEACTIVATION_REASON_MAX}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(null);
          }}
          error={reasonError}
          placeholder="e.g. Repeated spam messages reported by members"
        />
      </Modal>
      <ConfirmDialog
        open={dialog === 'reactivate'}
        tone="primary"
        title={`Reactivate ${u?.name ?? 'this account'}?`}
        message="They will be able to log in again and will appear in search."
        confirmLabel="Reactivate"
        busy={busy}
        onConfirm={() => change('active')}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
