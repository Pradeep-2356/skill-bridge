import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SearchX, Compass, SlidersHorizontal, Sparkles, FilterX } from 'lucide-react';
import { SEARCH_SORTS } from '@skillbridge/shared';
import { PageHeader, Button, EmptyState, ErrorState, Skeleton, Pagination } from '../components/ui/index.js';
import { MentorCard } from '../features/discover/MentorCard.jsx';
import { SkillSearchBox } from '../features/discover/SkillSearchBox.jsx';
import { FilterPanel, ActiveFilters, EMPTY_FILTERS, hasFilters } from '../features/discover/Filters.jsx';
import cardStyles from '../features/discover/MentorCard.module.css';
import discoverStyles from '../features/discover/Discover.module.css';
import { searchApi, skillsApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/misc.js';
import styles from './DiscoverPage.module.css';

const PAGE_SIZE = 12;
const SORT_LABELS = {
  relevance: 'Best match',
  name: 'Name (A–Z)',
  newest: 'Newest members',
  availability: 'Most shared time',
};

/** Reads every search setting from the URL (?q=react&days=0,2&sort=name&page=2). */
function readParams(params) {
  return {
    q: (params.get('q') ?? '').trim(),
    filters: {
      category: params.get('category') ?? '',
      proficiency: params.get('proficiency') ?? '',
      days: (params.get('days') ?? '')
        .split(',')
        .filter((d) => d !== '')
        .map(Number)
        .filter((d) => d >= 0 && d <= 6),
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      tzCompatible: params.get('tz') === '1',
    },
    sort: SEARCH_SORTS.includes(params.get('sort')) ? params.get('sort') : 'relevance',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

function writeParams({ q, filters, sort, page }) {
  const out = {};
  if (q) out.q = q;
  if (filters.category) out.category = filters.category;
  if (filters.proficiency) out.proficiency = filters.proficiency;
  if (filters.days.length) out.days = filters.days.join(',');
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  if (filters.tzCompatible) out.tz = '1';
  if (sort && sort !== 'relevance') out.sort = sort;
  if (page > 1) out.page = String(page);
  return out;
}

/**
 * Mentor discovery (SB1/US50 extended by SB2/US1–7, US32–41).
 * Search text, filters, sort and page all live in the URL, so results can be
 * shared and the browser Back button restores the previous search.
 */
export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const state = readParams(params);
  const { q, filters, sort, page } = state;
  const [showFilters, setShowFilters] = useState(false);
  // Controls show the new value at once; the URL (and the search) follows a moment later.
  const [draft, setDraft] = useState(filters);
  const urlKey = params.toString();
  useEffect(() => setDraft(readParams(new URLSearchParams(urlKey)).filters), [urlKey]);
  const changeFilters = (f) => {
    setDraft(f);
    update({ filters: f });
  };
  useDocumentTitle(q ? `“${q}” mentors` : 'Discover mentors');

  const categories = useApi(() => skillsApi.categories(), []);
  const query = useMemo(
    () => ({
      ...(q ? { q } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.proficiency ? { proficiency: filters.proficiency } : {}),
      ...(filters.days.length ? { days: filters.days.join(',') } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
      ...(filters.tzCompatible ? { tzCompatible: true } : {}),
      sort,
      page,
      limit: PAGE_SIZE,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString()],
  );
  const { data, meta, loading, error, reload } = useApi(() => searchApi.mentors(query), [JSON.stringify(query)]);

  const update = (patch) => setParams(writeParams({ ...state, page: 1, ...patch }));
  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    update({ filters: EMPTY_FILTERS });
  };
  const filtered = hasFilters(filters);
  const categoryList = categories.data?.categories ?? [];
  const activeCount = [
    filters.category,
    filters.proficiency,
    filters.days.length,
    filters.from || filters.to,
    filters.tzCompatible,
  ].filter(Boolean).length;

  return (
    <>
      <PageHeader
        title="Discover mentors"
        subtitle="Search by skill, then narrow the list by category, level, time and time zone."
        actions={
          <Button variant="secondary" leftIcon={Sparkles} to="/matches">
            Suggested for you
          </Button>
        }
      />
      <SkillSearchBox value={q} onSearch={(text) => update({ q: text })} />

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <Button
            variant="secondary"
            className={styles.filterToggle}
            leftIcon={SlidersHorizontal}
            aria-expanded={showFilters}
            aria-controls="discover-filters"
            onClick={() => setShowFilters((s) => !s)}
          >
            Filters{activeCount ? ` (${activeCount})` : ''}
          </Button>
          <div className={`${styles.filterBox} ${showFilters ? styles.filterBoxOpen : ''}`}>
            <FilterPanel
              id="discover-filters"
              filters={draft}
              categories={categoryList}
              onChange={changeFilters}
              onClear={clearFilters}
            />
          </div>
        </div>

        <div className={styles.results} aria-live="polite" aria-busy={loading}>
          <div className={styles.toolbar}>
            <p className={styles.count} data-testid="result-count">
              {meta && !loading ? (
                <>
                  <strong>{meta.total}</strong> {meta.total === 1 ? 'mentor' : 'mentors'}
                  {q ? <> for “{q}”</> : null}
                </>
              ) : (
                'Searching…'
              )}
            </p>
            <label className={styles.sort}>
              <span>Sort by</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort results">
                {SEARCH_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {SORT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ActiveFilters filters={draft} categories={categoryList} onChange={changeFilters} onClear={clearFilters} />

          {loading || (!data && !error) ? (
            <div className={cardStyles.grid}>
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} height={240} radius="var(--radius-lg)" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : data.mentors.length === 0 ? (
            <EmptyState
              icon={filtered ? FilterX : q ? SearchX : Compass}
              title={filtered ? 'No mentors match these filters' : q ? `No mentors found for “${q}”` : 'No mentors yet'}
              description={
                filtered
                  ? 'Try removing a filter or widening the time range.'
                  : 'Check the spelling, try a shorter or more general word, or pick one of these skills.'
              }
              action={
                <div className={discoverStyles.emptyActions}>
                  {filtered ? (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                  {meta?.relatedSkills?.length ? (
                    <div className={styles.popular} aria-label="Related skills">
                      {meta.relatedSkills.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={styles.popularChip}
                          onClick={() => update({ q: s.name, filters: EMPTY_FILTERS })}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
          ) : (
            <>
              <ul className={cardStyles.grid} aria-label="Search results">
                {data.mentors.map((m) => (
                  <MentorCard key={m.id} mentor={m} />
                ))}
              </ul>
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onChange={(p) => setParams(writeParams({ ...state, page: p }))}
                label="Search result pages"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
