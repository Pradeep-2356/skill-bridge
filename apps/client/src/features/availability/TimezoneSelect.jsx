import { useMemo } from 'react';
import { LocateFixed } from 'lucide-react';
import { Select, Button } from '../../components/ui/index.js';
import { browserTimeZone, sameTimeZone, timeZoneGroups, zoneOffsetLabel } from '../../utils/format.js';

/** IANA time-zone picker with a "use my current time zone" shortcut (SB1/US29). */
export function TimezoneSelect({ value, onChange, error, name = 'timezone', label = 'Time zone' }) {
  const groups = useMemo(() => timeZoneGroups(), []);
  const detected = browserTimeZone();
  const known = groups.some((g) => g.options.some((o) => o.value === value));
  const allGroups =
    known || !value
      ? groups
      : [{ label: 'Current', options: [{ value, label: `${value} (${zoneOffsetLabel(value)})` }] }, ...groups];

  return (
    <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
      <Select
        name={name}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        groups={allGroups}
        error={error}
        hint={`Current offset: ${zoneOffsetLabel(value) || '—'}. Other people see your times converted to their own zone.`}
      />
      {!sameTimeZone(detected, value) ? (
        <Button
          variant="link"
          size="sm"
          leftIcon={LocateFixed}
          onClick={() => onChange(detected)}
          style={{ justifySelf: 'start' }}
        >
          Use my current time zone ({detected})
        </Button>
      ) : null}
    </div>
  );
}
