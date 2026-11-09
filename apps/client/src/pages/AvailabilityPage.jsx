import { useEffect, useMemo, useState } from 'react';
import { Save, Eraser, Sunrise, Moon, CalendarRange } from 'lucide-react';
import { LIMITS, availabilitySchema, toFieldErrors, totalAvailableMinutes } from '@skillbridge/shared';
import { PageHeader, Button, Card, Checkbox, Alert, Skeleton, ErrorState, Badge } from '../components/ui/index.js';
import { AvailabilityGrid } from '../features/availability/AvailabilityGrid.jsx';
import { TimezoneSelect } from '../features/availability/TimezoneSelect.jsx';
import { WeeklyBars } from '../features/availability/WeeklyBars.jsx';
import { availabilityApi } from '../features/api.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/misc.js';
import { summariseSlots } from '../utils/format.js';
import page from './Page.module.css';

const PRESETS = [
  { id: 'evenings', label: 'Weekday evenings', icon: Moon, days: [0, 1, 2, 3, 4], start: '18:00', end: '21:00' },
  { id: 'weekend', label: 'Weekend mornings', icon: Sunrise, days: [5, 6], start: '09:00', end: '12:00' },
  { id: 'office', label: 'Weekday lunch', icon: CalendarRange, days: [0, 1, 2, 3, 4], start: '12:30', end: '13:30' },
];

/** Adds preset ranges, merging with what is already selected. */
function applyPreset(slots, preset) {
  const others = slots.filter(
    (s) => !(preset.days.includes(s.day) && s.start === preset.start && s.end === preset.end),
  );
  return [...others, ...preset.days.map((day) => ({ day, start: preset.start, end: preset.end }))];
}

/** SB1/US27 (days), US28 (time ranges), US29 (time zone). */
export default function AvailabilityPage() {
  useDocumentTitle('Availability');
  const toast = useToast();
  const { user, setUser } = useAuth();
  const { data, loading, error, reload } = useApi(() => availabilityApi.get(), []);
  const [slots, setSlots] = useState([]);
  const [timezone, setTimezone] = useState(user.timezone);
  const [saved, setSaved] = useState({ slots: [], timezone: user.timezone });
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (data) {
      setSlots(data.slots);
      setTimezone(data.timezone);
      setSaved({ slots: data.slots, timezone: data.timezone });
      if (data.slots.some((s) => s.start < '06:00' || s.end > '23:00')) setShowAll(true);
    }
  }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(slots) !== JSON.stringify(saved.slots) || timezone !== saved.timezone,
    [slots, timezone, saved],
  );
  const tooMany = slots.length > LIMITS.MAX_AVAILABILITY_SLOTS;
  const hours = totalAvailableMinutes(slots) / 60;

  async function save() {
    setErrors({});
    const parsed = availabilitySchema.safeParse({ timezone, slots });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      toast.error('Please fix the highlighted problems before saving.');
      return;
    }
    setSaving(true);
    try {
      const { data: result } = await availabilityApi.save(parsed.data);
      setSlots(result.slots);
      setSaved(result);
      setUser({ ...user, timezone: result.timezone, availability: result.slots });
      toast.success('Your availability has been saved.');
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle="When are you free for 30-minute sessions? Times are in your own time zone."
        actions={
          <Button leftIcon={Save} onClick={save} loading={saving} disabled={!dirty || tooMany || loading}>
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        }
      />
      {loading ? (
        <Skeleton height={480} radius="var(--radius-lg)" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        <div className={page.split}>
          <Card
            title="Weekly schedule"
            subtitle="Click or drag across the grid to mark when you’re available. Keyboard: arrow keys and Space."
            action={<Badge tone="primary">{hours % 1 === 0 ? hours : hours.toFixed(1)} h / week</Badge>}
          >
            <div className={page.stack} style={{ gap: 'var(--space-4)' }}>
              <div className={page.chips}>
                {PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="secondary"
                    leftIcon={p.icon}
                    onClick={() => setSlots((s) => applyPreset(s, p))}
                  >
                    {p.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={Eraser}
                  onClick={() => setSlots([])}
                  disabled={slots.length === 0}
                >
                  Clear all
                </Button>
              </div>
              <Checkbox
                name="showAllHours"
                label="Show all 24 hours"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              <div style={{ maxHeight: 620, overflowY: 'auto' }}>
                <AvailabilityGrid slots={slots} onChange={setSlots} showAllHours={showAll} />
              </div>
              {tooMany ? (
                <Alert tone="danger" title="Too many separate time ranges">
                  You have {slots.length} ranges; the limit is {LIMITS.MAX_AVAILABILITY_SLOTS}. Join some ranges
                  together to save.
                </Alert>
              ) : null}
              {Object.keys(errors).length ? (
                <Alert tone="danger" title="Some ranges need attention">
                  {Object.values(errors)[0]}
                </Alert>
              ) : null}
            </div>
          </Card>
          <div className={page.stack}>
            <Card title="Time zone">
              <TimezoneSelect value={timezone} onChange={setTimezone} error={errors.timezone} />
            </Card>
            <Card title="Summary" subtitle={`${slots.length} time range${slots.length === 1 ? '' : 's'}`}>
              {slots.length === 0 ? (
                <p className={page.muted}>No times selected yet. Use the grid or a preset to get started.</p>
              ) : (
                <div className={page.stack} style={{ gap: 'var(--space-4)' }}>
                  <WeeklyBars slots={slots} />
                  <ul className={page.list} style={{ gap: 'var(--space-1)', fontSize: 'var(--text-sm)' }}>
                    {summariseSlots(slots).map((d) => (
                      <li key={d.day}>
                        <strong>{d.label}</strong> <span className="text-secondary">{d.ranges.join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            {dirty ? (
              <Alert tone="warning" title="Unsaved changes">
                Press “Save changes” to keep your new schedule.
              </Alert>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
