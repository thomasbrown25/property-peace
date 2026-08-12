import test from 'node:test';
import assert from 'node:assert/strict';

import { getCurrentRentPresentation } from './paymentSummaryPresentation.js';

test('labels an overdue installment once as rent due with its due date', () => {
  const result = getCurrentRentPresentation({
    dueDate: '2026-08-01T00:00:00',
    isOverdue: true
  });

  assert.deepEqual(result, {
    label: 'Rent Due',
    dueLabel: 'Due August 1',
    isOverdue: true
  });
});

test('keeps rent due neutral while it is still within the grace period', () => {
  const result = getCurrentRentPresentation({
    dueDate: '2026-08-01T00:00:00',
    isOverdue: false
  });

  assert.equal(result.label, 'Rent Due');
  assert.equal(result.dueLabel, 'Due August 1');
  assert.equal(result.isOverdue, false);
});
