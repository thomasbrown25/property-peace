import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dashboard = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
const navigator = readFileSync(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
const dock = readFileSync(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/navigation/types.ts', import.meta.url), 'utf8');

// Source wiring checks: these do not replace an on-device navigation walkthrough.
test('dashboard collection cards open the selected native property detail', () => {
  assert.match(dashboard, /onProperty=\{propertyId => navigation\.getParent\(\)\?\.navigate\('Properties', \{ screen: 'PropertyDetail', params: \{ propertyId \} \}\)\}/);
});

test('property detail header returns to the Home Properties tab', () => {
  assert.match(navigator, /name="PropertyDetail"[\s\S]*?headerLeft: \(\) => <PageBackButton inHeader onPress=\{\(\) => \{[\s\S]*?navigation\.getParent\(\)\?\.navigate\('Dashboard', \{ screen: 'DashboardHome', params: \{ homeTab: 'Properties' \} \}\)/);
  assert.match(types, /DashboardHome: \{ homeTab\?: 'Properties' \} \| undefined/);
  assert.match(dashboard, /route\.params\?\.homeTab === 'Properties'[\s\S]*?setActiveHomeTab\('Properties'\)/);
});

test('landlord bottom Properties destination opens the Home Properties tab, retaining tenant behavior', () => {
  assert.match(dock, /routeName === 'Properties' && audience === 'landlord'/);
  assert.match(dock, /navigation\.navigate\('Dashboard', \{ screen: 'DashboardHome', params: \{ homeTab: 'Properties' \} \}\)/);
  assert.match(dock, /onPress=\{\(\) => \{\s*if \(open\) hideSheet\(\);\s*openTabRoot\(route\.name\)/);
});
