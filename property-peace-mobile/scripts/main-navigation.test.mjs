import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

let visibleMainTabsForAudience;
let mainTabIconNames;
let resolveVisibleMainTabs;
let dockSplitIndex;
let loadError;

try {
  ({ visibleMainTabsForAudience, mainTabIconNames, resolveVisibleMainTabs, dockSplitIndex } = await import(
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

test('More occupies the rightmost dock slot without the quick-action plus', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /visibleRoutes\.map\(renderTab\)[\s\S]*accessibilityLabel="More"/);
  assert.doesNotMatch(sheet, /plusButton|styles\.plusButton|accessibilityLabel="Quick actions"/);
  assert.match(sheet, /rgba\(34, 47, 62, 0\.82\)/);
});

test('scrollable More menu preserves native routes and labels web-only destinations', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  for (const destination of ['Leases', 'Applications', 'Listings', 'Checklists', 'Tenants', 'Notifications', 'Settings', 'Team']) {
    assert.match(sheet, new RegExp(`route: '${destination}'`));
  }
  assert.doesNotMatch(sheet, /webPath: '\/landlord\/listings'/);
  assert.match(navigator, /name="Applications" component={ApplicationsScreen}/);
  assert.match(navigator, /name="Listings" component={ListingsScreen}/);
  assert.match(sheet, /webPath: '\/tenant\/lease'/);
  assert.match(sheet, /webAppUrl[\s\S]*api\.propertypeace\.io/);
  assert.match(sheet, /<ScrollView[^>]*showsVerticalScrollIndicator/);
  assert.match(sheet, /<Modal visible={open} transparent animationType="none"/);
  assert.match(sheet, /<Pressable style={styles.backdrop}/);
  assert.match(sheet, /<Animated.View style=\{\[styles.sheet,[\s\S]*transform: \[\{ translateY: sheetOffset \}\]/);
  assert.match(sheet, /Animated\.timing\(sheetOffset/);
  assert.doesNotMatch(sheet, /animationType="slide"/);
  assert.match(sheet, /Math\.max\(insets\.bottom/);
  assert.match(navigator, /name="Checklists" component={ChecklistsNavigator}/);
  assert.match(navigator, /name="Team" component={TeamScreen}/);
  assert.match(sheet, /'Team', 'Announcements'/);
  assert.doesNotMatch(sheet, /webPath: '\/landlord\/admin-members'/);
});
