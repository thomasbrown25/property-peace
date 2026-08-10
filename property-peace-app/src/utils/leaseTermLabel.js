export function getLeaseTermLabel({ hasLease, total, current }) {
  if (!hasLease) return 'No lease';
  return total ? `Month ${current} / ${total}` : 'Not started';
}
