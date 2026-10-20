import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const navigator = readFileSync(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
const dock = readFileSync(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');

test('the shared bottom dock reserves layout space for every tab and nested screen', () => {
  assert.match(navigator, /<Tab\.Navigator[\s\S]*?tabBar=\{\(props\) => <QuickActionsTabBar/);
  const area = dock.match(/dockArea:\s*\{([^}]*)\}/)?.[1];
  assert.ok(area, 'dockArea style must exist');
  assert.doesNotMatch(area, /position:\s*['"]absolute['"]|bottom:\s*0/);
  assert.match(area, /paddingTop:\s*\d+/);
  assert.match(dock, /Math\.max\(insets\.bottom,\s*10\)\s*\+\s*6/);
});

test('light bottom dock uses white canvas and white pill, retaining the search-button border', () => {
  const dashboard = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  const searchButton = dashboard.match(/headerButton:\s*\{[^}]*backgroundColor:\s*'([^']+)'[^}]*borderColor:\s*'([^']+)'/)?.slice(1);
  assert.ok(searchButton, 'dashboard search button colors must be available');
  assert.match(dock, /dockArea,\s*\{ backgroundColor: colors\.background/);
  assert.match(dock, /pill,\s*\{ backgroundColor: mode === 'dark' \? [^:]+ : colors\.surface/);
  assert.match(readFileSync(new URL('../src/theme/AppTheme.tsx', import.meta.url), 'utf8'), /light:\s*\{\s*background:\s*'#ffffff', surface:\s*'#ffffff'/);
  assert.ok(dock.includes(`: '${searchButton[1]}'`), 'pill light border should match dashboard search button');
});
