import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { visibleMainTabsForAudience, mainTabIconNames } from '../src/navigation/mainTabModel.ts';

const source = path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('landlord dock shows exactly five destinations plus the User avatar', async () => {
  const dock = await source('navigation/QuickActionsTabBar.tsx');
  assert.deepEqual(visibleMainTabsForAudience('landlord').map(tab => tab.label || tab.name),
    ['Home', 'Team', 'Checklists', 'Reports', 'Messages']);
  assert.deepEqual(mainTabIconNames('Team'), { active: 'people', inactive: 'people-outline' });
  assert.match(dock, /\['Dashboard', 'Team', 'Checklists', 'Reports', 'Messages'\]/);
  assert.match(dock, /accessibilityLabel="User"[\s\S]*openTabRoot\('Settings'\)/);
});

test('home tabs are in requested order with working native destinations', async () => {
  const dashboard = await source('screens/landlord/DashboardScreen.tsx');
  assert.match(dashboard, /const homeTabs: HomeTab\[\] = \['Dashboard', 'Calendar', 'Properties', 'Rent', 'Tenants', 'Maintenances', 'Leases'\]/);
  assert.doesNotMatch(dashboard, /if \(tab === 'Tenants' \|\| tab === 'Leases'\)/);
  assert.match(dashboard, /\(activeHomeTab === 'Tenants' \|\| activeHomeTab === 'Leases'\) && <DashboardSection borderless>/);
  assert.match(dashboard, /<HomeDirectoryTab key=\{`\$\{organizationId\}:\$\{activeHomeTab\}`\}/);
  assert.match(dashboard, /activeHomeTab === 'Maintenances'/);
  assert.match(dashboard, /onPress=\{\(\) => setOpenMenu\(openMenu === 'notifications' \? null : 'notifications'\)\}/);
  assert.match(dashboard, /notifications-outline/);
  assert.match(dashboard, /navigate\('Notifications'\)/);
});

test('shared landlord header has Notifications instead of Messages; tenant header retains messaging', async () => {
  const header = await source('components/LandlordPageHeader.tsx');
  const navigator = await source('navigation/MainNavigator.tsx');
  const reports = await source('screens/landlord/ReportsScreen.tsx');
  assert.match(header, /isTenant \? 'chatbubble-ellipses-outline' : 'notifications-outline'/);
  assert.match(header, /: \(\) => tabs\?\.navigate\('Notifications'\)/);
  for (const route of ['Properties', 'Tenants', 'Maintenance', 'Notifications'])
    assert.match(navigator, new RegExp(`name="${route}" component=`));
  assert.match(reports, /\/landlord\/reports/);
  assert.match(reports, /A web app URL is not configured for this build/);
});
