import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const navigator = readFileSync(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
const dock = readFileSync(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');

test('the floating dock keeps safe-area spacing without painting over scrolling content', () => {
  assert.match(navigator, /<Tab\.Navigator[\s\S]*?tabBar=\{\(props\) => <QuickActionsTabBar/);
  const area = dock.match(/dockArea:\s*\{([^}]*)\}/)?.[1];
  assert.ok(area, 'dockArea style must exist');
  assert.match(area, /position:\s*'absolute', bottom:\s*0/);
  assert.match(area, /paddingTop:\s*\d+/);
  assert.match(dock, /pointerEvents="box-none"/);
  assert.match(dock, /Math\.max\(insets\.bottom,\s*10\)\s*\+\s*6/);
  assert.doesNotMatch(dock, /dockArea,\s*\{ backgroundColor:/);
  for (const screen of ['DashboardScreen', 'PropertiesScreen', 'TenantsScreen', 'NotificationsScreen', 'SettingsScreen']) {
    const source = readFileSync(new URL(`../src/screens/landlord/${screen}.tsx`, import.meta.url), 'utf8');
    assert.match(source, /paddingBottom:\s*120/, `${screen} needs clearance below the floating dock`);
  }
});

test('light bottom pill is translucent, retaining its border and dark-mode surface', () => {
  const dashboard = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  const searchButton = dashboard.match(/headerButton:\s*\{[^}]*backgroundColor:\s*'([^']+)'[^}]*borderColor:\s*'([^']+)'/)?.slice(1);
  assert.ok(searchButton, 'dashboard search button colors must be available');
  assert.match(dock, /pill,\s*\{ backgroundColor: mode === 'dark' \? 'rgba\(24, 27, 31, 0\.82\)' : 'rgba\(255, 255, 255, 0\.88\)'/);
  assert.ok(dock.includes(`: '${searchButton[1]}'`), 'pill light border should match dashboard search button');
});
