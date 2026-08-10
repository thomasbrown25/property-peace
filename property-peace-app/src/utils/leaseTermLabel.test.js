import test from 'node:test';
import assert from 'node:assert/strict';

import { getLeaseTermLabel } from './leaseTermLabel.js';

test('shows No lease when the row has no lease', () => {
  assert.equal(getLeaseTermLabel({ hasLease: false, total: 0, current: 0 }), 'No lease');
});

test('shows the current month for a lease with a term', () => {
  assert.equal(getLeaseTermLabel({ hasLease: true, total: 12, current: 3 }), 'Month 3 / 12');
});

test('keeps Not started for an existing lease without a calculated term', () => {
  assert.equal(getLeaseTermLabel({ hasLease: true, total: 0, current: 0 }), 'Not started');
});
