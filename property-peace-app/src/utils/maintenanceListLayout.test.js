import test from 'node:test';
import assert from 'node:assert/strict';

test('maintenance filters expand to four columns on desktop and collapse responsively', async () => {
  let layout;

  try {
    layout = await import('./maintenanceListLayout.js');
  } catch {
    layout = null;
  }

  assert.deepEqual(layout?.maintenanceFilterGridSx?.gridTemplateColumns, {
    xs: 'minmax(0, 1fr)',
    md: 'repeat(2, minmax(0, 1fr))',
    lg: 'repeat(4, minmax(0, 1fr))'
  });
  assert.equal(layout?.maintenanceFilterControlSx?.width, '100%');
  assert.equal(layout?.maintenanceFilterSummarySx?.justifyContent?.lg, 'flex-end');
});
