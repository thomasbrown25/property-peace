import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeasePagePath, getUnitStatusPresentation } from './unitPresentation.js';

test('unit status presentation keeps vacancy calm and distinguishes lease states', () => {
  assert.deepEqual(getUnitStatusPresentation('vacant'), { label: 'Vacant', tone: 'neutral' });
  assert.deepEqual(getUnitStatusPresentation('occupied'), { label: 'Occupied', tone: 'success' });
  assert.deepEqual(getUnitStatusPresentation('overdue'), { label: 'Payment overdue', tone: 'error' });
  assert.deepEqual(getUnitStatusPresentation('draft'), { label: 'Draft lease', tone: 'warning' });
  assert.deepEqual(getUnitStatusPresentation('notStarted'), { label: 'Upcoming lease', tone: 'info' });
  assert.deepEqual(getUnitStatusPresentation('unknown'), { label: 'Vacant', tone: 'neutral' });
});

test('lease page path accepts a real lease id and fails closed without one', () => {
  assert.equal(getLeasePagePath(42), '/landlord/leases/42');
  assert.equal(getLeasePagePath('42'), '/landlord/leases/42');
  assert.equal(getLeasePagePath(undefined), null);
  assert.equal(getLeasePagePath(0), null);
  assert.equal(getLeasePagePath('not-an-id'), null);
});
