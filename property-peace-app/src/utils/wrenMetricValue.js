const CURRENCY_NUMBER = /^\s*\$?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*$/;
const MISSING_VALUE = /^(?:[-–—]|n\/?a|none|null|unknown|not available|not applicable)$/i;

export function hasWrenDisplayValue(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && Boolean(value.trim()) && !MISSING_VALUE.test(value.trim());
}

export function isZeroWrenMetricValue(value) {
  if (typeof value === 'number') return value === 0;
  if (typeof value !== 'string') return false;
  const number = value.replace(/%\s*$/, '').match(CURRENCY_NUMBER)?.[1];
  return number !== undefined && Number(number.replaceAll(',', '')) === 0;
}

export function formatWrenMetricValue(metric) {
  const value = metric?.value;
  if (!metric?.money) return value;
  if (value === undefined || value === null || String(value).trim() === '') return '—';

  const numericValue = typeof value === 'number'
    ? value
    : Number(String(value).match(CURRENCY_NUMBER)?.[1]?.replaceAll(',', ''));

  if (!Number.isFinite(numericValue)) return String(value);

  return numericValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  });
}
