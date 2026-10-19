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
