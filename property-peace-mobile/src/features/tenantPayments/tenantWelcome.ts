export function tenantWelcome(user: { FirstName?: string; firstName?: string } | null): string {
  const firstName = (user?.FirstName?.trim() || user?.firstName?.trim() || '').split(/\s+/)[0];
  return firstName ? `Welcome ${firstName}` : 'Welcome';
}
