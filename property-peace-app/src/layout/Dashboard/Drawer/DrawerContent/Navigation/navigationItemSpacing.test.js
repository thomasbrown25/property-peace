import test from 'node:test';
import assert from 'node:assert/strict';

test('top-level expandable rows use the same vertical padding as leaf rows', async () => {
  let spacing;

  try {
    spacing = await import('./navigationItemSpacing.js');
  } catch {
    spacing = null;
  }

  assert.equal(typeof spacing?.getNavigationItemVerticalPadding, 'function', 'navigation rows should share one vertical-padding rule');
  assert.equal(spacing.getNavigationItemVerticalPadding({ drawerOpen: true, level: 1 }), 1);
  assert.equal(spacing.getNavigationItemVerticalPadding({ drawerOpen: false, level: 1 }), 1);
});
