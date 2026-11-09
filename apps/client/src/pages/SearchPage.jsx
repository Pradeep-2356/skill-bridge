import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, SearchX, Compass } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import { PageHeader, Button, EmptyState, ErrorState, Skeleton, Pagination } from '../components/ui/index.js';
import { MentorCard } from '../features/search/MentorCard.jsx';
import cardStyles from '../features/search/MentorCard.module.css';
import { searchApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/misc.js';
import styles from './SearchPage.module.css';

const POPULAR = [
  'React',
  'Python',
  'Public speaking',
  'Guitar',
  'Spanish',
  'Data analysis',
  'UI design',
  'Photography',
];

/**
 * SB1/US50 – keyword skill search. The query lives in the URL (?q=react&page=2),
 * so results can be bookmarked and the browser Back button works.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const pageNo = Math.max(1, Number(params.get('page')) || 1);
  const [text, setText] = useState(q);
  useDocumentTitle(q ? `“${q}” mentors` : 'Find mentors');

  useEffect(() => setText(q), [q]);

  const { data, meta, loading, error, reload } = useApi(
    () => searchApi.mentors({ q, page: pageNo, limit: 12 }),
    [q, pageNo],
    { enabled: Boolean(q) },
  );

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (value) setParams({ q: value });
  }

  return (
    <>
      <PageHeader title="Find mentors" subtitle="Search for a skill to find people who can teach it." />
      <form role="search" className={styles.form} onSubmit={submit} aria-label="Search mentors by skill">
        <label htmlFor="skill-search" className="sr-only">
          Skill to search for
        </label>
        <div className={styles.inputWrap}>
          <Search size={20} className={styles.icon} aria-hidden="true" />
          <input
            id="skill-search"
            type="search"
            className={styles.input}
            placeholder="Try “react”, “guitar” or “spanish”"
            value={text}
            maxLength={LIMITS.SEARCH_QUERY_MAX}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={!text.trim()}>
          Search
        </Button>
      </form>

      <div className={styles.results} aria-live="polite" aria-busy={loading}>
        {!q ? (
          <EmptyState
            icon={Compass}
            title="What would you like to learn?"
            description="Pick a popular skill or type your own."
            action={
              <div className={styles.popular}>
                {POPULAR.map((p) => (
                  <button key={p} type="button" className={styles.popularChip} onClick={() => setParams({ q: p })}>
                    {p}
                  </button>
                ))}
              </div>
            }
          />
        ) : loading || (!data && !error) ? (
          <div className={cardStyles.grid}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} height={240} radius="var(--radius-lg)" />
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data.mentors.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`No mentors found for “${q}”`}
            description="Check the spelling, try a shorter or more general word (for example “java” instead of “java spring boot”), or pick a popular skill."
            action={
              <div className={styles.popular}>
                {POPULAR.slice(0, 4).map((p) => (
                  <button key={p} type="button" className={styles.popularChip} onClick={() => setParams({ q: p })}>
                    {p}
                  </button>
                ))}
              </div>
            }
          />
        ) : (
          <>
            <p className={styles.count}>
              <strong>{meta.total}</strong> {meta.total === 1 ? 'mentor teaches' : 'mentors teach'} skills matching “{q}
              ”
            </p>
            <ul className={cardStyles.grid} aria-label="Search results">
              {data.mentors.map((m) => (
                <MentorCard key={m.id} mentor={m} />
              ))}
            </ul>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onChange={(p) => setParams({ q, page: String(p) })}
              label="Search result pages"
            />
          </>
        )}
      </div>
    </>
  );
}
