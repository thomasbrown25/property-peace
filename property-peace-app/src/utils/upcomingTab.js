const list = (value) => Array.isArray(value) ? value : [];

const propertyIdentity = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const searchText = (entry) => [
  entry?.name,
  entry?.category,
  entry?.propertyName,
  entry?.unitName,
  entry?.type,
  entry?.frequency,
  entry?.source?.vendor,
  entry?.source?.Vendor
].filter(Boolean).join(' ').toLocaleLowerCase();

export function selectUpcomingEntries(entries, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase();
  const type = ['Recurring', 'One-time'].includes(filters.type) ? filters.type : 'all';
  const propertyId = propertyIdentity(filters.propertyId);

  return list(entries).filter((entry) => {
    if (propertyId !== undefined) {
      const entryPropertyId = propertyIdentity(entry?.source?.propertyId ?? entry?.source?.PropertyId);
      if (entryPropertyId !== propertyId) return false;
    }
    if (type !== 'all' && entry?.type !== type) return false;
    if (search && !searchText(entry).includes(search)) return false;
    return true;
  });
}
