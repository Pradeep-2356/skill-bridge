import { useEffect, useState } from 'react';

/** Delays a fast-changing value (typing) until it settles. */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Sets the browser tab title for each page (Stage 3 accessibility checklist). */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · SkillBridge` : 'SkillBridge';
  }, [title]);
}
