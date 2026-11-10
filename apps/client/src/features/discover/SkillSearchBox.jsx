import { useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import { skillsApi } from '../api.js';
import { useDebounce } from '../../hooks/misc.js';
import { pluralise } from '../../utils/format.js';
import styles from './Discover.module.css';

/**
 * Search box with live skill suggestions (SB2/US1, US2, US41).
 * Follows the ARIA combobox pattern: arrow keys move through suggestions,
 * Enter picks one (or searches the typed text), Escape closes the list.
 */
export function SkillSearchBox({ value, onSearch, autoFocus = false }) {
  const [text, setText] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const debounced = useDebounce(text, 200);
  const listId = useId();
  const inputRef = useRef(null);
  const call = useRef(0);

  useEffect(() => setText(value ?? ''), [value]);

  useEffect(() => {
    const q = debounced.trim();
    // Suggest for the term being typed after the last comma (multi-term search).
    const lastTerm = q
      .split(/,|\bor\b/i)
      .at(-1)
      .trim();
    if (lastTerm.length < 1) {
      setItems([]);
      return;
    }
    call.current += 1;
    const id = call.current;
    skillsApi
      .suggest({ q: lastTerm })
      .then(({ data }) => id === call.current && setItems(data.skills))
      .catch(() => id === call.current && setItems([]));
  }, [debounced]);

  const showList = open && items.length > 0;

  function choose(skill) {
    const parts = text.split(',');
    parts[parts.length - 1] = parts.length > 1 ? ` ${skill.name}` : skill.name;
    const next = parts.join(',').trim();
    setText(next);
    setOpen(false);
    setActive(-1);
    onSearch(next);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (items.length ? (i + 1) % items.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter' && showList && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    }
  }

  function submit(e) {
    e.preventDefault();
    setOpen(false);
    onSearch(text.trim());
  }

  return (
    <form role="search" className={styles.searchForm} onSubmit={submit} aria-label="Search mentors by skill">
      <div className={styles.searchWrap}>
        <Search size={20} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          id="skill-search"
          type="text"
          role="combobox"
          aria-label="Skill to search for"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          className={styles.searchInput}
          placeholder="Try “react”, “guitar, piano” or “python or java”"
          value={text}
          maxLength={LIMITS.SEARCH_QUERY_MAX}
          autoFocus={autoFocus}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {text ? (
          <button
            type="button"
            className={styles.clearText}
            aria-label="Clear search text"
            onClick={() => {
              setText('');
              setItems([]);
              onSearch('');
              inputRef.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
        <ul id={listId} role="listbox" aria-label="Skill suggestions" className={styles.suggestions} hidden={!showList}>
          {items.map((skill, i) => (
            <li
              key={skill.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`${styles.suggestion} ${i === active ? styles.suggestionActive : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(skill)}
            >
              <span className={styles.suggestionName}>{skill.name}</span>
              <span className={styles.suggestionMeta}>
                {skill.category?.name} · {skill.mentorCount ? pluralise(skill.mentorCount, 'mentor') : 'no mentors yet'}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit" className={styles.searchButton}>
        Search
      </button>
    </form>
  );
}
