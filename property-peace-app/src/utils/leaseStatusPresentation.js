export function getLeaseStatusPresentation({ draft = false, active = false, ended = false } = {}) {
  if (draft) return { label: 'Draft', color: 'warning', variant: 'filled' };
  if (active) return { label: 'Active', color: 'success', variant: 'filled' };
  if (ended) return { label: 'Ended lease', color: 'default', variant: 'outlined' };
  return { label: 'Not started', color: 'default', variant: 'outlined' };
}
