import { useEffect, useId, useRef, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { normalizeSkillName } from '@skillbridge/shared';
import { useDebounce } from '../../hooks/misc.js';
import { skillsApi } from '../api.js';
import styles from './Skills.module.css';

/**
 * Catalogue autocomplete (WAI-ARIA combobox). Picks an existing skill, or offers
 * "Add “Origami” as a new skill" when nothing matches (SB1/US20, US22).
 * value: { skill } | { customName } | null
 */
export function SkillPicker({ value, onChange, excludeIds = [], error, kind = 'teach' }) {
  const id = useId().replace(/:/g, '');
  const inputId = `field-skillId`;
  const listId = `skill-options-${id}`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(text, 200);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    skillsApi
      .catalog({ q: debounced || undefined, limit: 8 })
      .then(({ data }) => !cancelled && setOptions(data.skills.filter((s) => !excludeIds.includes(s.id))))
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, open]);

  const trimmed = text.trim();
  const exact = options.some((o) => normalizeSkillName(o.name) === normalizeSkillName(trimmed));
  const items = [
    ...options.map((o) => ({ type: 'skill', skill: o })),
    ...(trimmed.length >= 2 && !exact ? [{ type: 'custom', name: trimmed }] : []),
  ];

  function choose(item) {
    if (!item) return;
    onChange(item.type === 'skill' ? { skill: item.skill } : { customName: item.name });
    setOpen(false);
    setText('');
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  if (value?.skill || value?.customName) {
    const name = value.skill?.name ?? value.customName;
    return (
      <div className={styles.pickerSelected}>
        <span className={styles.pickerLabel}>Skill</span>
        <div className={`${styles.selectedSkill} ${styles[`selected-${kind}`]}`}>
          <div>
            <p className={styles.selectedName}>{name}</p>
            <p className={styles.selectedMeta}>
              {value.skill ? (value.skill.category?.name ?? 'Catalogue skill') : 'New skill – an admin will review it'}
            </p>
          </div>
          <button
            type="button"
            className={styles.changeButton}
            onClick={() => {
              onChange(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <X size={14} aria-hidden="true" /> Change
          </button>
        </div>
        {error ? (
          <p id={`${inputId}-error`} className={styles.pickerError}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <label htmlFor={inputId} className={styles.pickerLabel}>
        Skill{' '}
        <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>
          *
        </span>
      </label>
      <div className={styles.pickerInputWrap}>
        <Search size={18} className={styles.pickerIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          className={`${styles.pickerInput} ${error ? styles.pickerInvalid : ''}`}
          placeholder="Search the skill catalogue, e.g. React, Guitar, Spanish"
          value={text}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          maxLength={60}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className={styles.pickerError}>
          {error}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className={styles.pickerHint}>
          Can’t find it? Type the full name and choose “Add as a new skill”.
        </p>
      )}
      {open ? (
        <ul id={listId} role="listbox" className={styles.options} aria-label="Matching skills">
          {loading && items.length === 0 ? <li className={styles.optionMuted}>Searching…</li> : null}
          {!loading && items.length === 0 ? (
            <li className={styles.optionMuted}>Type at least 2 letters to add a new skill.</li>
          ) : null}
          {items.map((item, i) => (
            <li
              key={item.type === 'skill' ? item.skill.id : 'custom'}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.option} ${i === active ? styles.optionActive : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {item.type === 'skill' ? (
                <>
                  <span>{item.skill.name}</span>
                  <span className={styles.optionMeta}>{item.skill.category?.name}</span>
                </>
              ) : (
                <span className={styles.optionCustom}>
                  <Plus size={14} aria-hidden="true" /> Add “{item.name}” as a new skill
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
