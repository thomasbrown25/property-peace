import test from 'node:test';
import assert from 'node:assert/strict';

test('maintenance filters use compact desktop columns and collapse responsively', async () => {
  let layout;

  try {
    layout = await import('./maintenanceListLayout.js');
  } catch {
    layout = null;
  }

  assert.deepEqual(layout?.maintenanceFilterGridSx?.gridTemplateColumns, {
    xs: 'minmax(0, 1fr)',
    md: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(6, minmax(0, 1fr))',
    xl: 'repeat(8, minmax(0, 1fr))'
  });
  assert.equal(layout?.maintenanceFilterGridSx?.gap, 0.75);
  assert.equal(layout?.maintenanceFilterControlSx?.width, '100%');
  assert.equal(layout?.maintenanceFilterSummarySx?.justifyContent?.lg, 'flex-end');
});
