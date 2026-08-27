export const dashboardWorkspaceTabs = [
  { key: 'overview', label: 'Overview', path: '/landlord/dashboard?tab=overview', icon: 'overview' },
  { key: 'calendar', label: 'Calendar', path: '/landlord/dashboard?tab=calendar', icon: 'calendar' },
  { key: 'tasks', label: 'Tasks', path: '/landlord/dashboard?tab=tasks', icon: 'tasks' }
];

export function getDashboardWorkspaceTab(pathname = '', search = '') {
  if (pathname === '/landlord/calendar' || pathname.startsWith('/landlord/calendar/')) return 'calendar';
  if (pathname === '/landlord/tasks' || pathname.startsWith('/landlord/tasks/')) return 'tasks';
  if (pathname === '/landlord/dashboard' || pathname.startsWith('/landlord/dashboard/')) {
    const requestedTab = new URLSearchParams(search).get('tab');
    return dashboardWorkspaceTabs.some((tab) => tab.key === requestedTab) ? requestedTab : 'overview';
  }
  return 'overview';
}
