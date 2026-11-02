import test from 'node:test';
import assert from 'node:assert/strict';
import { getLeaseHeaderBalance } from './leaseHeaderSummary.js';

test('uses the canonical total due and shows just the overdue portion alongside it', () => {
  assert.deepEqual(getLeaseHeaderBalance({ rentDue: 1500, overdueAmount: 400 }), { amountDue: 1500, overdueAmount: 400 });
});

test('shows the current due amount as overdue when the entire current balance is late', () => {
  assert.deepEqual(getLeaseHeaderBalance({ rentDue: 700, overdueAmount: 0, rentDueIsOverdue: true }), { amountDue: 700, overdueAmount: 700 });
});

test('does not double-count the current installment already included in canonical overdue amount', () => {
  assert.deepEqual(getLeaseHeaderBalance({ rentDue: 1500, overdueAmount: 400, currentMonthRentDue: 1100, currentMonthRentIsOverdue: true }), { amountDue: 1500, overdueAmount: 400 });
});

test('does not show an overdue annotation on a current or paid lease', () => {
  assert.deepEqual(getLeaseHeaderBalance({ rentDue: 700, overdueAmount: 0 }), { amountDue: 700, overdueAmount: 0 });
  assert.deepEqual(getLeaseHeaderBalance({ rentDue: 0, overdueAmount: 0 }), { amountDue: 0, overdueAmount: 0 });
});

test('uses the lease balance only when no collection record exists, and drafts never owe rent', () => {
  assert.deepEqual(getLeaseHeaderBalance(null, 250), { amountDue: 250, overdueAmount: 0 });
  assert.deepEqual(getLeaseHeaderBalance(null, 250, true), { amountDue: 0, overdueAmount: 0 });
});
