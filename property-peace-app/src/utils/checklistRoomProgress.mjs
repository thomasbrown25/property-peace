export function getItemComplete(item) {
  return !!(item?.condition || item?.isChecked || item?.IsChecked);
}

export function getRoomProgress(items = []) {
  const total = items.length;
  const done = items.filter(getItemComplete).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function getRoomTone(items = []) {
  const conditions = items.map((item) => String(item?.condition || '').trim().toUpperCase()).filter(Boolean);
  if (conditions.some((condition) => condition === 'NR' || condition === 'RP')) return 'error';
  if (conditions.some((condition) => condition !== 'GOOD')) return 'warning';
  return items.length > 0 && items.every((item) => String(item?.condition || '').trim().toUpperCase() === 'GOOD')
    ? 'success'
    : 'neutral';
}
