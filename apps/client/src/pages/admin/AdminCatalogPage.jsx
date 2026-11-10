import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, Pencil, Plus, Trash2, Tags, FolderTree, Inbox } from 'lucide-react';
import { categoryCreateSchema, categoryUpdateSchema, LIMITS } from '@skillbridge/shared';
import {
  PageHeader,
  Tabs,
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  FormErrorSummary,
  EmptyState,
  ErrorState,
  Skeleton,
  Pagination,
} from '../../components/ui/index.js';
import { adminCatalogApi } from '../../features/api.js';
import { useApi } from '../../hooks/useApi.js';
import { useForm } from '../../hooks/useForm.js';
import { useDocumentTitle } from '../../hooks/misc.js';
import { useToast } from '../../context/ToastContext.jsx';
import { relativeTime } from '../../utils/format.js';
import styles from './Admin.module.css';

/** Create or edit a category (SB2/US47). */
function CategoryForm({ category, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(category);
  const form = useForm({
    initialValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? 'tag',
      order: category?.order ?? 0,
      isActive: category?.isActive ?? true,
    },
    schema: editing ? categoryUpdateSchema : categoryCreateSchema,
    onSubmit: async (values) => {
      const body = { ...values, order: Number(values.order) };
      if (!editing) delete body.order;
      const { data } = editing
        ? await adminCatalogApi.updateCategory(category.id, body)
        : await adminCatalogApi.createCategory(body);
      toast.success(editing ? `${data.category.name} saved.` : `${data.category.name} created.`);
      onSaved();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit ${category.name}` : 'New category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={form.submitting}>
            {editing ? 'Save category' : 'Create category'}
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        onSubmit={form.handleSubmit}
        noValidate
        aria-label="Category"
        style={{ display: 'grid', gap: 'var(--space-4)' }}
      >
        <FormErrorSummary
          ref={form.summaryRef}
          errors={form.errors}
          formError={form.formError}
          labels={{ name: 'Name', description: 'Description', icon: 'Icon', order: 'Order' }}
        />
        <TextInput label="Name" required maxLength={LIMITS.CATEGORY_NAME_MAX} {...form.field('name')} />
        <TextArea
          label="Description"
          rows={2}
          maxLength={LIMITS.CATEGORY_DESCRIPTION_MAX}
          {...form.field('description')}
        />
        <TextInput label="Icon" hint="A Lucide icon name, e.g. code, music, palette" {...form.field('icon')} />
        {editing ? (
          <>
            <TextInput label="Order" type="number" min={0} max={999} {...form.field('order')} />
            <Checkbox
              id="category-active"
              label="Show this category to members"
              hint="Hidden categories stay attached to existing skills but cannot be picked."
              checked={form.values.isActive}
              onChange={(e) => form.setField('isActive', e.target.checked)}
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}

/** Rename, re-categorise, add aliases and approve a skill (SB2/US47, US42). */
function SkillForm({ skill, categories, onClose, onSaved }) {
  const toast = useToast();
  const [values, setValues] = useState({
    name: skill.name,
    categoryId: skill.category?.id ?? '',
    aliases: skill.aliases.join(', '),
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function save(approve) {
    setBusy(true);
    setErrors({});
    try {
      const aliases = values.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      const { data } = await adminCatalogApi.updateSkill(skill.id, {
        name: values.name.trim(),
        categoryId: values.categoryId || undefined,
        aliases,
        ...(approve ? { status: 'approved' } : {}),
      });
      toast.success(approve ? `${data.skill.name} approved.` : `${data.skill.name} saved.`);
      onSaved();
    } catch (err) {
      setErrors(err.fields ?? { _form: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Review “${skill.name}”`}
      description="Tidy the name and category, add other spellings as aliases, then approve."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => save(false)} loading={busy}>
            Save
          </Button>
          {skill.status === 'pending' ? (
            <Button leftIcon={Check} onClick={() => save(true)} loading={busy}>
              Save and approve
            </Button>
          ) : null}
        </>
      }
    >
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        {errors._form ? (
          <p role="alert" className={styles.formError}>
            {errors._form}
          </p>
        ) : null}
        <TextInput
          id="skill-name"
          label="Name"
          value={values.name}
          error={errors.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        <Select
          id="skill-category"
          label="Category"
          value={values.categoryId}
          error={errors.categoryId}
          onChange={(e) => setValues({ ...values, categoryId: e.target.value })}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextInput
          id="skill-aliases"
          label="Aliases"
          hint="Other names people search for, separated by commas"
          value={values.aliases}
          onChange={(e) => setValues({ ...values, aliases: e.target.value })}
        />
      </div>
    </Modal>
  );
}

function PendingSkills({ categories }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const { data, meta, loading, error, reload } = useApi(
    () => adminCatalogApi.skills({ status: 'pending', page, limit: 20 }),
    [page],
  );

  async function approve(skill) {
    try {
      await adminCatalogApi.updateSkill(skill.id, { status: 'approved' });
      toast.success(`${skill.name} approved.`);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading && !data) return <Skeleton height={200} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data.skills.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="No skills waiting for review"
        description="Custom skills that members add appear here."
      />
    );
  }
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Custom skills awaiting review, oldest first</caption>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Category</th>
              <th scope="col">Added by</th>
              <th scope="col">Used by</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.skills.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.name}</strong>
                  {s.aliases.length ? <div className={styles.email}>also: {s.aliases.join(', ')}</div> : null}
                </td>
                <td>{s.category?.name ?? '—'}</td>
                <td>
                  {s.createdBy ? (
                    <Link to={`/admin/users/${s.createdBy.id}`}>{s.createdBy.name}</Link>
                  ) : (
                    'Former member'
                  )}
                  <div className={styles.email}>{relativeTime(s.createdAt)}</div>
                </td>
                <td className={styles.numbers}>
                  {s.teachers} teach · {s.learners} learn
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <Button size="sm" leftIcon={Check} onClick={() => approve(s)}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={Pencil}
                      onClick={() => setEditing(s)}
                      aria-label={`Review ${s.name}`}
                    >
                      Review
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} label="Pending skill pages" />
      {editing ? (
        <SkillForm
          skill={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function Categories({ data, loading, error, reload }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await adminCatalogApi.deleteCategory(deleting.id);
      toast.success(`${deleting.name} deleted.`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(err.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton height={240} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  return (
    <>
      <div className={styles.toolbar}>
        <Button leftIcon={Plus} onClick={() => setEditing('new')}>
          New category
        </Button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">Skill categories in display order</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Skills</th>
              <th scope="col">Pending</th>
              <th scope="col">Mentors</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <div className={styles.email}>{c.description || c.slug}</div>
                </td>
                <td className={styles.numbers}>{c.skillCount}</td>
                <td className={styles.numbers}>{c.pendingCount}</td>
                <td className={styles.numbers}>{c.mentorCount}</td>
                <td>{c.isActive ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</td>
                <td>
                  <div className={styles.rowActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={Pencil}
                      onClick={() => setEditing(c)}
                      aria-label={`Edit ${c.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={Trash2}
                      onClick={() => setDeleting(c)}
                      aria-label={`Delete ${c.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ''}?`}
        message={
          deleting?.skillCount
            ? `${deleting.name} still has ${deleting.skillCount} skills, so it cannot be deleted. Hide it instead.`
            : 'This cannot be undone. Members who chose it as an interest will have it removed.'
        }
        confirmLabel="Delete category"
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}

/** Admin: categories and custom-skill review (SB2/US47). */
export default function AdminCatalogPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'categories' ? 'categories' : 'pending';
  useDocumentTitle('Skill catalogue');
  const categories = useApi(() => adminCatalogApi.categories(), []);
  const pendingTotal = categories.data?.categories.reduce((sum, c) => sum + c.pendingCount, 0);
  return (
    <>
      <PageHeader title="Skill catalogue" subtitle="Keep categories organised and review skills that members added." />
      <Tabs
        tabs={[
          { id: 'pending', label: 'Skills to review', icon: Tags, count: pendingTotal },
          { id: 'categories', label: 'Categories', icon: FolderTree },
        ]}
        value={tab}
        onChange={(id) => setParams(id === 'categories' ? { tab: id } : {})}
        label="Catalogue sections"
        idPrefix="catalog"
      />
      <div
        role="tabpanel"
        id={`catalog-panel-${tab}`}
        aria-labelledby={`catalog-${tab}`}
        style={{ marginTop: 'var(--space-5)' }}
      >
        {tab === 'pending' ? (
          <PendingSkills categories={categories.data?.categories ?? []} />
        ) : (
          <Categories {...categories} />
        )}
      </div>
    </>
  );
}
