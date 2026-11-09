import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Pencil, Trash2, Sparkles, GraduationCap } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import {
  PageHeader,
  Button,
  IconButton,
  Tabs,
  TabPanel,
  EmptyState,
  ErrorState,
  Skeleton,
  ConfirmDialog,
  LevelDots,
  Badge,
  levelLabel,
} from '../components/ui/index.js';
import { SkillFormModal } from '../features/skills/SkillFormModal.jsx';
import { skillsApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';
import styles from '../features/skills/Skills.module.css';

const COPY = {
  teach: {
    intro: 'Skills you can teach make you discoverable as a mentor. Add your level so learners can choose well.',
    empty: 'You haven’t added any teaching skills yet',
    emptyText: 'Add something you know well – a programming language, an instrument, a language, a hobby.',
    add: 'Add teaching skill',
    icon: Sparkles,
  },
  learn: {
    intro: 'Skills you want to learn help mentors understand what you need, and the level you want to be taught at.',
    empty: 'You haven’t added any learning goals yet',
    emptyText: 'What would you like to get better at? Add a skill and the level you want to reach.',
    add: 'Add learning skill',
    icon: GraduationCap,
  },
};

function EntryCard({ kind, entry, onEdit, onRemove }) {
  const level = kind === 'teach' ? entry.proficiency : entry.preferredLevel;
  const text = kind === 'teach' ? entry.description : entry.goal;
  return (
    <li className={`${styles.entry} ${styles[`entry-${kind}`]}`}>
      <div className={styles.entryTop}>
        <div>
          <h3 className={styles.entryName}>{entry.skill?.name}</h3>
          <p className={styles.entryCategory}>{entry.skill?.category?.name}</p>
        </div>
        <div className={styles.entryActions}>
          <IconButton icon={Pencil} label={`Edit ${entry.skill?.name}`} size="sm" onClick={() => onEdit(entry)} />
          <IconButton
            icon={Trash2}
            label={`Remove ${entry.skill?.name}`}
            size="sm"
            variant="danger"
            onClick={() => onRemove(entry)}
          />
        </div>
      </div>
      <p className={`${styles.entryLevel} ${styles[`entryLevel-${kind}`]}`}>
        <LevelDots kind={kind} value={level} />
        {kind === 'teach' ? levelLabel('teach', level) : `Wants ${levelLabel('learn', level).toLowerCase()} level`}
        {kind === 'teach' && entry.yearsExperience ? (
          <span className="text-muted"> · {entry.yearsExperience} yrs</span>
        ) : null}
      </p>
      {text ? <p className={styles.entryText}>{text}</p> : null}
      {entry.skill?.status === 'pending' ? <Badge tone="warning">New skill · awaiting admin review</Badge> : null}
    </li>
  );
}

/** SB1/US20–26: add, edit and remove teaching and learning skills. */
export default function SkillsPage() {
  useDocumentTitle('Skills');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'learn' ? 'learn' : 'teach';
  const toast = useToast();
  const skills = useApi(() => skillsApi.mine(), []);
  const categories = useApi(() => skillsApi.categories(), []);
  const [modal, setModal] = useState(null); // { kind, entry }
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const lists = { teach: skills.data?.teachSkills ?? [], learn: skills.data?.learnSkills ?? [] };
  const field = (kind) => (kind === 'teach' ? 'teachSkills' : 'learnSkills');
  const max = (kind) => (kind === 'teach' ? LIMITS.MAX_TEACH_SKILLS : LIMITS.MAX_LEARN_SKILLS);

  function onSaved(entry, { editing }) {
    const kind = modal.kind;
    skills.setData((d) => ({
      ...d,
      [field(kind)]: editing ? d[field(kind)].map((e) => (e.id === entry.id ? entry : e)) : [...d[field(kind)], entry],
    }));
    toast.success(
      editing
        ? `${entry.skill.name} updated.`
        : `${entry.skill.name} added to your ${kind === 'teach' ? 'teaching' : 'learning'} skills.`,
    );
    setModal(null);
  }

  async function confirmRemove() {
    const { kind, entry } = removing;
    setBusy(true);
    try {
      await skillsApi.remove(kind, entry.id);
      skills.setData((d) => ({ ...d, [field(kind)]: d[field(kind)].filter((e) => e.id !== entry.id) }));
      toast.success(`${entry.skill.name} removed.`);
      setRemoving(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    {
      id: 'teach',
      label: 'I can teach',
      icon: Sparkles,
      count: skills.data ? lists.teach.length : undefined,
      tone: 'teach',
    },
    {
      id: 'learn',
      label: 'I want to learn',
      icon: GraduationCap,
      count: skills.data ? lists.learn.length : undefined,
      tone: 'learn',
    },
  ];

  const copy = COPY[tab];
  const list = lists[tab];
  const full = list.length >= max(tab);

  return (
    <>
      <PageHeader title="Skills" subtitle="What you can teach, and what you want to learn." />
      <Tabs
        tabs={tabs}
        value={tab}
        onChange={(id) => setParams({ tab: id }, { replace: true })}
        label="Skill lists"
        idPrefix="skills"
      />
      <TabPanel id={tab} idPrefix="skills">
        <div className={styles.listHeader}>
          <p className={styles.listIntro}>{copy.intro}</p>
          <Button
            leftIcon={Plus}
            onClick={() => setModal({ kind: tab, entry: null })}
            disabled={!skills.data || full}
            title={full ? `You can add up to ${max(tab)} skills` : undefined}
          >
            {copy.add}
          </Button>
        </div>
        {skills.loading ? (
          <div className={styles.entryList}>
            <Skeleton height={140} radius="var(--radius-lg)" />
            <Skeleton height={140} radius="var(--radius-lg)" />
          </div>
        ) : skills.error ? (
          <ErrorState message={skills.error.message} onRetry={skills.reload} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={copy.icon}
            title={copy.empty}
            description={copy.emptyText}
            action={
              <Button leftIcon={Plus} onClick={() => setModal({ kind: tab, entry: null })}>
                {copy.add}
              </Button>
            }
          />
        ) : (
          <ul
            className={styles.entryList}
            aria-label={tab === 'teach' ? 'Skills I can teach' : 'Skills I want to learn'}
          >
            {list.map((entry) => (
              <EntryCard
                key={entry.id}
                kind={tab}
                entry={entry}
                onEdit={(e) => setModal({ kind: tab, entry: e })}
                onRemove={(e) => setRemoving({ kind: tab, entry: e })}
              />
            ))}
          </ul>
        )}
        {full ? (
          <p className="text-muted" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            You’ve reached the limit of {max(tab)} skills. Remove one to add another.
          </p>
        ) : null}
      </TabPanel>

      <SkillFormModal
        open={Boolean(modal)}
        kind={modal?.kind ?? tab}
        entry={modal?.entry ?? null}
        existingSkillIds={(lists[modal?.kind ?? tab] ?? []).map((e) => e.skill?.id)}
        categories={categories.data?.categories ?? []}
        onClose={() => setModal(null)}
        onSaved={onSaved}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.entry.skill?.name ?? 'skill'}?`}
        message={`It will no longer appear on your profile${removing?.kind === 'teach' ? ' or in mentor search' : ''}. You can add it again later.`}
        confirmLabel="Remove skill"
        busy={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
