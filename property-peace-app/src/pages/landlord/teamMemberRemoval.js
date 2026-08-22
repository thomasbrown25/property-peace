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
  const name = member.name || member.email || 'This team member';
  const organizationName = organization.name || 'this organization';

  return {
    title: 'Remove team member?',
    name,
    email: member.email || '',
    role: member.role || 'Viewer',
    initials: initialsFor(member.name, member.email),
    consequence: `${name} will immediately lose access to ${organizationName}.`,
    cancelLabel: 'Keep team member',
    confirmLabel: 'Remove access'
  };
}
