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

test('landlord dock contains Home, Team, Checklists, Reports, Messages in order', () => {
  assert.equal(loadError, undefined);
  const tabs = visibleMainTabsForAudience('landlord');
  assert.deepEqual(tabs.map((tab) => tab.name), ['Dashboard', 'Team', 'Checklists', 'Reports', 'Messages']);
  assert.equal(tabs[0].label, 'Home');
  assert.deepEqual(mainTabIconNames('Team'), { active: 'people', inactive: 'people-outline' });
  assert.deepEqual(mainTabIconNames('Reports'), { active: 'bar-chart', inactive: 'bar-chart-outline' });
});

test('tenant navigation does not show the landlord Checklists tab', () => {
  assert.equal(loadError, undefined);
  assert.equal(visibleMainTabsForAudience('tenant').find((tab) => tab.name === 'Maintenance')?.label, undefined);
  assert.deepEqual(
    visibleMainTabsForAudience('tenant').map((tab) => tab.name),
    ['Payments', 'Leases', 'Maintenance', 'Messages', 'Settings'],
  );
  assert.deepEqual(mainTabIconNames('Leases'), { active: 'document-text', inactive: 'document-text-outline' });
});

test('every visible native-stack back button hides its previous-screen title', async () => {
  const main = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  const checklists = await readFile(new URL('../src/navigation/ChecklistsNavigator.tsx', import.meta.url), 'utf8');
  const auth = await readFile(new URL('../src/navigation/AuthNavigator.tsx', import.meta.url), 'utf8');
  assert.match(main, /function useStackOptions\(\)[\s\S]*headerBackTitleVisible: false/);
  assert.match(checklists, /<Stack\.Navigator[\s\S]*headerBackTitleVisible: false/);
  assert.match(auth, /<Stack\.Navigator[\s\S]*headerShown: false/);
  assert.doesNotMatch(main + checklists, /headerBackTitleVisible: true|headerBackTitle:/);
  const detail = await readFile(new URL('../src/screens/tenant/TenantMaintenanceDetailScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(detail, /‹ Maintenance/);
  for (const screen of ['ForgotPasswordScreen', 'MfaVerificationScreen']) {
    const source = await readFile(new URL(`../src/screens/auth/${screen}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /<Ionicons name="arrow-back"/);
    assert.doesNotMatch(source, /<Text[^>]*>Back to (?:login|Sign In)<\/Text>/);
  }
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

test('landlord dock resolves all five animated destination components', () => {
  assert.equal(loadError, undefined);
  const tabs = resolveVisibleMainTabs('landlord', {
    DashboardScreen: 'dashboard-screen',
    TeamScreen: 'team-screen',
    ReportsScreen: 'reports-screen',
    PropertiesNavigator: 'properties-navigator',
    ChecklistsNavigator: 'checklists-navigator',
    MaintenanceNavigator: 'maintenance-navigator',
    MarketingNavigator: 'marketing-navigator',
    TenantMaintenanceNavigator: 'tenant-maintenance-navigator',
    TenantsNavigator: 'tenants-navigator',
    MessagesNavigator: 'messages-navigator',
    NotificationsScreen: 'notifications-screen',
    SettingsScreen: 'settings-screen',
  });

  assert.equal(tabs.length, 5);
  assert.equal(tabs.find((tab) => tab.name === 'Team')?.component, 'team-screen');
  assert.equal(tabs.find((tab) => tab.name === 'Reports')?.component, 'reports-screen');
  assert.equal(tabs.find((tab) => tab.name === 'Messages')?.component, 'messages-navigator');
});

test('landlord Messages moves to dock, while Notifications and Tenants remain routable', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /\['Dashboard', 'Team', 'Checklists', 'Reports', 'Messages'\]/);
  assert.match(navigator, /name="Notifications" component={NotificationsScreen} options=\{\{ tabBarButton: \(\) => null \}\}/);
  assert.match(navigator, /name="Tenants" component={TenantsNavigator} options=\{\{ tabBarButton: \(\) => null \}\}/);
});

test('profile occupies the rightmost dock slot without the quick-action plus', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  assert.match(sheet, /visibleRoutes\.map\(renderTab\)[\s\S]*accessibilityLabel="User"/);
  assert.doesNotMatch(sheet, /plusButton|styles\.plusButton|accessibilityLabel="Quick actions"/);
  assert.match(sheet, /rgba\(24, 27, 31, 0\.82\)/);
});

test('Messages uses the same scene and press animation as the other dock tabs', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  assert.match(navigator, /NotificationsScreen,\s*SettingsScreen: SettingsNavigator/);
  assert.match(navigator, /visibleTabs\.map\(\(tab, index\) => \(\{ \.\.\.tab, component: withTabTransition\(tab\.component, index\)/);
  assert.match(navigator, /audience === 'tenant' && <Tab\.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarButton: \(\) => null }}/);
  assert.match(sheet, /\['Dashboard', 'Team', 'Checklists', 'Reports', 'Messages'\]/);
  assert.match(sheet, /visibleRoutes\.map\(renderTab\)/);
  assert.match(sheet, /<AnimatedTab[\s\S]*onPress=\{\(\) => \{[\s\S]*openTabRoot\(route\.name\)/);
  assert.doesNotMatch(sheet, /\['Notifications', 'Leases'/);
  assert.doesNotMatch(sheet, /accessibilityLabel="Notifications"/);
});

test('scrollable More menu preserves native routes and labels web-only destinations', async () => {
  const sheet = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  for (const destination of ['Leases', 'Maintenance']) {
    assert.match(sheet, new RegExp(`route: '${destination}'`));
  }
  const landlordMenu = sheet.slice(sheet.indexOf('const landlordMenu:'), sheet.indexOf('const tenantMenu:'));
  for (const removed of ['Tenants', 'Messages', 'Notifications', 'Team', 'Checklists', 'Reports']) {
    assert.doesNotMatch(landlordMenu, new RegExp(`label: '${removed}'[^\\n]*route: '${removed}'`));
  }
  assert.doesNotMatch(sheet, /webPath: '\/landlord\/listings'/);
  assert.match(navigator, /name="Applications" component={ApplicationsNavigator}/);
  assert.match(navigator, /name="Listings" component={ListingsNavigator}/);
  assert.match(sheet, /const tenantMenu:[\s\S]*label: 'Payments'[^\n]*route: 'Payments'/);
  assert.match(sheet, /webAppUrl[\s\S]*api\.propertypeace\.io/);
  assert.match(sheet, /<ScrollView[^>]*showsVerticalScrollIndicator/);
  assert.match(sheet, /<Modal visible={open} transparent animationType="none"/);
  assert.match(sheet, /<Pressable style={styles.backdrop}/);
  assert.match(sheet, /<Animated.View style=\{\[styles.sheet,[\s\S]*transform: \[\{ translateX: sheetOffset \}\]/);
  assert.match(sheet, /Animated\.timing\(sheetOffset/);
  assert.doesNotMatch(sheet, /animationType="slide"/);
  assert.match(sheet, /Math\.max\(insets\.bottom/);
  assert.match(navigator, /ChecklistsNavigator,/);
  assert.match(navigator, /TeamScreen,/);
  assert.match(sheet, /\['Dashboard', 'Team', 'Checklists', 'Reports', 'Messages'\]/);
  assert.doesNotMatch(sheet, /webPath: '\/landlord\/admin-members'/);
});
