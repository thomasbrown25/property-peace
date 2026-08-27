import assert from 'node:assert/strict';
import test from 'node:test';

let dashboardWorkspace = {};

try {
  dashboardWorkspace = await import('./dashboardWorkspace.js');
} catch {
  // The first TDD run intentionally exercises the missing workspace module.
}

test('dashboard workspace navigation maps Overview, Calendar, and Tasks to their landlord routes', () => {
  assert.deepEqual(
    dashboardWorkspace.dashboardWorkspaceTabs?.map(({ key, label, path }) => ({ key, label, path })),
    [
      { key: 'overview', label: 'Overview', path: '/landlord/dashboard?tab=overview' },
      { key: 'calendar', label: 'Calendar', path: '/landlord/dashboard?tab=calendar' },
      { key: 'tasks', label: 'Tasks', path: '/landlord/dashboard?tab=tasks' }
    ]
  );
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/tasks'), 'tasks');
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/calendar'), 'calendar');
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/dashboard'), 'overview');
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/dashboard', '?tab=calendar'), 'calendar');
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/dashboard', '?tab=tasks'), 'tasks');
  assert.equal(dashboardWorkspace.getDashboardWorkspaceTab?.('/landlord/dashboard', '?tab=unknown'), 'overview');
});
