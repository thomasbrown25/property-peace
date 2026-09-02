const CURRENCY_NUMBER = /^\s*\$?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*$/;

export function formatPercyMetricValue(metric) {
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
