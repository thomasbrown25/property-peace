export const DEFAULT_TIMEZONE = 'America/New_York';

export function getBrowserTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone || DEFAULT_TIMEZONE;
  } catch (error) {
    return DEFAULT_TIMEZONE;
  }
}

export function buildTimezoneOptions(currentTimezone) {
  const baseOptions = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
    { value: 'America/Toronto', label: 'Toronto (Eastern Time)' },
    { value: 'America/Vancouver', label: 'Vancouver (Pacific Time)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'UTC', label: 'Coordinated Universal Time (UTC)' }
  ];

  if (currentTimezone && !baseOptions.some((option) => option.value === currentTimezone)) {
    return [{ value: currentTimezone, label: `${currentTimezone} (detected)` }, ...baseOptions];
  }

  return baseOptions;
}
