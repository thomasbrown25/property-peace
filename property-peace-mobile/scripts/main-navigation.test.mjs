import assert from 'node:assert/strict';
import test from 'node:test';

let visibleMainTabsForAudience;
let mainTabIconNames;
let resolveVisibleMainTabs;
let loadError;

try {
  ({ visibleMainTabsForAudience, mainTabIconNames, resolveVisibleMainTabs } = await import(
    '../src/navigation/mainTabModel.ts'
  ));
} catch (error) {
  loadError = error;
}

test('landlord navigation shows Checklists between Properties and Maintenance', () => {
  assert.equal(loadError, undefined);
  const tabs = visibleMainTabsForAudience('landlord');
  assert.deepEqual(
    tabs.map((tab) => tab.name),
    ['Dashboard', 'Properties', 'Checklists', 'Maintenance', 'Messages'],
  );
  assert.equal(
    tabs.find((tab) => tab.name === 'Checklists')?.component,
    'ChecklistsNavigator',
  );
});

test('tenant navigation does not show the landlord Checklists tab', () => {
  assert.equal(loadError, undefined);
  assert.deepEqual(
    visibleMainTabsForAudience('tenant').map((tab) => tab.name),
    ['Maintenance', 'Messages', 'Settings'],
  );
});

test('unsupported roles do not receive an empty tab navigator', () => {
  assert.equal(loadError, undefined);
  assert.deepEqual(visibleMainTabsForAudience('unsupported'), []);
});

test('Checklists uses clipboard icons in active and inactive states', () => {
  assert.equal(loadError, undefined);
  assert.deepEqual(mainTabIconNames('Checklists'), {
    active: 'clipboard',
    inactive: 'clipboard-outline',
  });
});

test('landlord tab assembly resolves Checklists to its navigator component', () => {
  assert.equal(loadError, undefined);
  const tabs = resolveVisibleMainTabs('landlord', {
    DashboardScreen: 'dashboard-screen',
    PropertiesNavigator: 'properties-navigator',
    ChecklistsNavigator: 'checklists-navigator',
    MaintenanceNavigator: 'maintenance-navigator',
    TenantMaintenanceNavigator: 'tenant-maintenance-navigator',
    MessagesNavigator: 'messages-navigator',
    SettingsScreen: 'settings-screen',
  });

  assert.equal(
    tabs.find((tab) => tab.name === 'Checklists')?.component,
    'checklists-navigator',
  );
});
