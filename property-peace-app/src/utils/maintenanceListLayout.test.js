import test from 'node:test';
import assert from 'node:assert/strict';

test('maintenance filters wrap responsively and use the page paper color', async () => {
  let layout;

  try {
    layout = await import('./maintenanceListLayout.js');
  } catch {
    layout = null;
  }

  assert.deepEqual(layout?.maintenanceFilterGridSx?.gridTemplateColumns, {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
    xl: 'minmax(0, 1.9fr) repeat(5, minmax(0, 1fr))'
  });
  assert.equal(layout?.maintenanceFilterControlSx?.width, '100%');
  assert.equal(layout?.maintenanceFilterControlSx?.height, undefined);
  assert.equal(layout?.maintenanceFilterControlSx?.bgcolor, 'background.paper');
  assert.equal(layout?.maintenanceSearchControlSx?.bgcolor, 'background.paper');
  assert.equal(layout?.maintenanceSearchControlSx?.gridColumn?.xs, '1 / -1');
});
