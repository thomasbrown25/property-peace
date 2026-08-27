function initialsFor(name, email) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length)
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  return String(email || '?')
    .slice(0, 2)
    .toUpperCase();
}

export function createTeamMemberRemovalModel(member = {}, organization = {}) {
  const safeMember = member ?? {};
  const safeOrganization = organization ?? {};
  const name = safeMember.name || safeMember.email || 'This team member';
  const organizationName = safeOrganization.name || 'this organization';

  return {
    title: 'Remove team member?',
    name,
    email: safeMember.email || '',
    role: safeMember.role || 'Viewer',
    initials: initialsFor(safeMember.name, safeMember.email),
    consequence: `${name} will immediately lose access to ${organizationName}.`,
    cancelLabel: 'Keep team member',
    confirmLabel: 'Remove access'
  };
}
