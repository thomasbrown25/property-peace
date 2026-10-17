const value = (lease, key) => lease?.[key] ?? lease?.[key[0].toUpperCase() + key.slice(1)];

const timestamp = (lease, key) => {
  const date = Date.parse(value(lease, key) || '');
  return Number.isFinite(date) ? date : 0;
};

export function recentPropertyLeases(leases) {
  if (!Array.isArray(leases)) return [];
  return leases
    .filter((lease) => Number(value(lease, 'id')) > 0 && value(lease, 'isDeleted') !== true)
    .sort((a, b) =>
      timestamp(b, 'createdAt') - timestamp(a, 'createdAt') ||
      timestamp(b, 'startDate') - timestamp(a, 'startDate') ||
      Number(value(b, 'id')) - Number(value(a, 'id'))
    )
    .slice(0, 10);
}
