import { useEffect, useMemo, useState } from 'react';
import {
  PROFICIENCY_LEVELS,
  LEARNING_LEVELS,
  LIMITS,
  teachSkillCreateSchema,
  teachSkillUpdateSchema,
  learnSkillCreateSchema,
  learnSkillUpdateSchema,
  toFieldErrors,
} from '@skillbridge/shared';
import { Modal, Button, TextArea, TextInput, Select, FormErrorSummary, LevelDots } from '../../components/ui/index.js';
import { SkillPicker } from './SkillPicker.jsx';
import { skillsApi } from '../api.js';
import styles from './Skills.module.css';

const LEVEL_HELP = {
  teach: {
    beginner: 'I know the basics and can explain them simply.',
    intermediate: 'I use it regularly and can guide beginners.',
    advanced: 'I handle complex problems and can teach best practice.',
    expert: 'Deep experience; I could teach it professionally.',
  },
  learn: {
    beginner: 'I’m new to this and want to start from the basics.',
    intermediate: 'I know the basics and want to build real confidence.',
    advanced: 'I’m comfortable already and want to go deeper.',
  },
};

/** Radio cards for choosing a level (SB1/US25 proficiency, SB1/US26 preferred level). */
function LevelPicker({ kind, value, onChange, error }) {
  const levels = kind === 'teach' ? PROFICIENCY_LEVELS : LEARNING_LEVELS;
  const name = kind === 'teach' ? 'proficiency' : 'preferredLevel';
  return (
    <fieldset className={styles.levelFieldset} aria-describedby={error ? `field-${name}-error` : undefined}>
      <legend className={styles.levelLegend}>
        {kind === 'teach' ? 'Your proficiency' : 'Level you want to be taught at'}
        <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>
          {' '}
          *
        </span>
      </legend>
      <div className={styles.levelGrid} id={`field-${name}`}>
        {levels.map((level) => (
          <label
            key={level.value}
            className={`${styles.levelCard} ${value === level.value ? styles[`levelOn-${kind}`] : ''}`}
          >
            <input
              type="radio"
              name={name}
              value={level.value}
              checked={value === level.value}
              onChange={() => onChange(level.value)}
              className="sr-only"
            />
            <span className={styles.levelTop}>
              <span className={styles.levelName}>{level.label}</span>
              <span style={{ color: kind === 'teach' ? 'var(--color-teach)' : 'var(--color-learn)' }}>
                <LevelDots kind={kind} value={level.value} />
              </span>
            </span>
            <span className={styles.levelHelp}>{LEVEL_HELP[kind][level.value]}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={`field-${name}-error`} className={styles.pickerError}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Add or edit a teach/learn skill (SB1/US20–26).
 * entry = existing entry when editing, null when adding.
 */
export function SkillFormModal({ open, kind, entry, existingSkillIds = [], categories = [], onClose, onSaved }) {
  const editing = Boolean(entry);
  const levelKey = kind === 'teach' ? 'proficiency' : 'preferredLevel';
  const textKey = kind === 'teach' ? 'description' : 'goal';
  const [choice, setChoice] = useState(null);
  const [values, setValues] = useState({ [levelKey]: '', [textKey]: '', yearsExperience: '', categoryId: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChoice(entry ? { skill: entry.skill } : null);
    setValues({
      [levelKey]: entry?.[levelKey] ?? '',
      [textKey]: entry?.[textKey] ?? '',
      yearsExperience: entry?.yearsExperience ?? '',
      categoryId: '',
    });
    setErrors({});
    setFormError(null);
  }, [open, entry, levelKey, textKey]);

  const schema = useMemo(() => {
    if (kind === 'teach') return editing ? teachSkillUpdateSchema : teachSkillCreateSchema;
    return editing ? learnSkillUpdateSchema : learnSkillCreateSchema;
  }, [kind, editing]);

  function buildBody() {
    const body = { [levelKey]: values[levelKey] || undefined, [textKey]: values[textKey] };
    if (kind === 'teach' && values.yearsExperience !== '' && values.yearsExperience !== null)
      body.yearsExperience = values.yearsExperience;
    if (!editing) {
      if (choice?.skill) body.skillId = choice.skill.id;
      if (choice?.customName) {
        body.customName = choice.customName;
        body.categoryId = values.categoryId || undefined;
      }
    }
    return body;
  }

  async function submit(e) {
    e.preventDefault();
    setFormError(null);
    const body = buildBody();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const { data } = editing
        ? await skillsApi.update(kind, entry.id, parsed.data)
        : await skillsApi.add(kind, parsed.data);
      onSaved(data.entry, { editing });
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const title = editing
    ? `Edit ${entry.skill?.name ?? 'skill'}`
    : kind === 'teach'
      ? 'Add a skill you can teach'
      : 'Add a skill you want to learn';

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={title}
      description={
        kind === 'teach'
          ? 'Learners use this to judge whether you are the right mentor.'
          : 'Mentors use this to understand what you need.'
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="skill-form" loading={saving}>
            {editing ? 'Save changes' : 'Add skill'}
          </Button>
        </>
      }
    >
      <form id="skill-form" className={styles.form} onSubmit={submit} noValidate>
        <FormErrorSummary
          errors={errors}
          formError={formError}
          labels={{ skillId: 'Skill', categoryId: 'Category', [levelKey]: 'Level' }}
        />
        {!editing ? (
          <SkillPicker
            kind={kind}
            value={choice}
            onChange={setChoice}
            excludeIds={existingSkillIds}
            error={errors.skillId ?? errors.customName}
          />
        ) : null}
        {!editing && choice?.customName ? (
          <Select
            name="categoryId"
            label="Category for the new skill"
            required
            placeholder="Choose a category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={values.categoryId}
            onChange={set('categoryId')}
            error={errors.categoryId}
          />
        ) : null}
        <LevelPicker
          kind={kind}
          value={values[levelKey]}
          onChange={(v) => setValues((s) => ({ ...s, [levelKey]: v }))}
          error={errors[levelKey]}
        />
        {kind === 'teach' ? (
          <TextInput
            name="yearsExperience"
            label="Years of experience"
            type="number"
            min={0}
            max={LIMITS.YEARS_EXPERIENCE_MAX}
            inputMode="numeric"
            hint="Optional"
            value={values.yearsExperience}
            onChange={set('yearsExperience')}
            error={errors.yearsExperience}
          />
        ) : null}
        <TextArea
          name={textKey}
          label={kind === 'teach' ? 'What can you help with?' : 'What do you want to achieve?'}
          hint={
            kind === 'teach'
              ? 'Optional. E.g. “Hooks, state management and testing components.”'
              : 'Optional. E.g. “Build my first portfolio website.”'
          }
          maxLength={kind === 'teach' ? LIMITS.SKILL_DESCRIPTION_MAX : LIMITS.LEARNING_GOAL_MAX}
          rows={3}
          value={values[textKey]}
          onChange={set(textKey)}
          error={errors[textKey]}
        />
      </form>
    </Modal>
  );
}
