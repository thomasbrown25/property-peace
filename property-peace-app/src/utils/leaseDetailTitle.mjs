export function leaseDetailTitle(lease, propertyDisplay, leaseId) {
  const name = lease?.name ?? lease?.Name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const id = lease?.id ?? lease?.Id ?? leaseId;
  return `${propertyDisplay}${id != null && String(id).trim() ? ` #${id}` : ''}`;
}
