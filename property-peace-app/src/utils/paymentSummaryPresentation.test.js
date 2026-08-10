import test from 'node:test';
import assert from 'node:assert/strict';

import { getCurrentRentPresentation } from './paymentSummaryPresentation.js';

test('labels an overdue current installment once with its month and due date', () => {
  const result = getCurrentRentPresentation({
    dueDate: '2026-08-01T00:00:00',
    isOverdue: true
  });

  assert.deepEqual(result, {
    label: 'August Rent',
    dueLabel: 'Due August 1',
    isOverdue: true
  });
});

test('keeps a current installment neutral while it is still within the grace period', () => {
  const result = getCurrentRentPresentation({
    dueDate: '2026-08-01T00:00:00',
    isOverdue: false
  });

  assert.equal(result.label, 'August Rent');
  assert.equal(result.dueLabel, 'Due August 1');
  assert.equal(result.isOverdue, false);
});
