import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { visibleMainTabsForAudience, mainTabIconNames } from '../src/navigation/mainTabModel.ts';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('landlord dock shows Marketing immediately after Tenants and keeps Maintenance off the dock', () => {
  assert.deepEqual(visibleMainTabsForAudience('landlord').map(tab => tab.name),
    ['Dashboard', 'Properties', 'Tenants', 'Marketing', 'Notifications']);
  assert.deepEqual(mainTabIconNames('Marketing'), { active: 'megaphone', inactive: 'megaphone-outline' });
  assert.equal(visibleMainTabsForAudience('tenant').some(tab => tab.name === 'Marketing'), false);
});

test('Marketing contains two selectable list views with the existing listing and application flows', async () => {
  const main = await read('../src/navigation/MainNavigator.tsx');
  const marketing = await read('../src/screens/landlord/MarketingScreen.tsx');
  assert.match(main, /MarketingNavigator,?/);
  assert.match(main, /name="MarketingHome" component={MarketingScreen}/);
  for (const name of ['AddListing', 'ListingDetail', 'ApplicationDetail']) {
    assert.match(main, new RegExp(`<MarketingStack.Screen name="${name}"`));
  }
  assert.match(marketing, /<ListingsScreen embedded/);
  assert.match(marketing, /<ApplicationsScreen embedded/);
  assert.match(marketing, /accessibilityRole="tablist"/);
  assert.match(marketing, /accessibilityState=\{\{ selected:/);
  assert.match(marketing, /title="Marketing"/);
});

test('landlord maintenance is accessible from the side menu and the route remains registered', async () => {
  const main = await read('../src/navigation/MainNavigator.tsx');
  const bar = await read('../src/navigation/QuickActionsTabBar.tsx');
  assert.match(main, /name="Maintenance" component={MaintenanceNavigator} options=\{\{ tabBarButton: \(\) => null \}\}/);
  assert.match(bar, /label: 'Maintenance'[^\n]*route: 'Maintenance'/);
  assert.match(bar, /'Applications', 'Maintenance'[^\n]*\.includes\(route.name\)/);
  assert.doesNotMatch(bar, /label: 'Listings'[^\n]*route: 'Listings'/);
  assert.doesNotMatch(bar, /label: 'Applications'[^\n]*route: 'Applications'/);
});
