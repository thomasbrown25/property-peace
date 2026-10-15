import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('landlord dock keeps four primary destinations and moves checklists into quick actions', () => {
  assert.equal(loadError, undefined);
  const tabs = visibleMainTabsForAudience('landlord');
  assert.deepEqual(
    tabs.map((tab) => tab.name),
    ['Dashboard', 'Properties', 'Maintenance', 'Messages'],
  );
  assert.equal(tabs.find((tab) => tab.name === 'Maintenance')?.label, undefined);
});

test('tenant navigation does not show the landlord Checklists tab', () => {
  assert.equal(loadError, undefined);
  assert.equal(visibleMainTabsForAudience('tenant').find((tab) => tab.name === 'Maintenance')?.label, undefined);
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

test('landlord dock resolves four destination components', () => {
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

  assert.equal(tabs.length, 4);
  assert.equal(tabs.find((tab) => tab.name === 'Messages')?.component, 'messages-navigator');
});

test('quick-action sheet keeps landlord destinations and tenant actions scoped', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  for (const destination of ['AddProperty', 'AddExpense', 'AddTenant', 'ChecklistPropertySearch', 'Leases']) {
    assert.match(sheet, new RegExp(`screen: '${destination}'|navigate\\('${destination}'\\)`));
  }
  assert.match(sheet, /TenantMaintenanceIntake/);
  assert.match(sheet, /audience === 'landlord'/);
  assert.match(sheet, /<Modal visible={open} transparent animationType="slide"/);
  assert.match(sheet, /Math\.max\(insets\.bottom/);
  assert.match(navigator, /name="Checklists" component={ChecklistsNavigator}/);
  assert.doesNotMatch(dashboard, /quickActionsOpen|QuickAction|Quick actions/);
});
