import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('../layout/Dashboard/index.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');

test('landlord Home fills the same uncapped page content shell as sibling routes', () => {
  assert.match(layout, /<Box data-testid="main-app-page-content" sx=\{\{[\s\S]*?maxWidth: 'none'/);
  const root = home.match(/return \(\s*<Box sx=\{\{([^}]+)\}\}>/);
  assert.ok(root, 'Home must have a root content wrapper');
  assert.match(root[1], /width: '100%'/);
  assert.match(root[1], /minWidth: 0/);
  assert.doesNotMatch(root[1], /maxWidth|mx:|px:/);
});
