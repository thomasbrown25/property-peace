import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessageRentStatus } from './messageRentStatus.mjs';

const lease = 21;
test('shows overdue from the selected lease even when another lease is paid', () => {
  assert.equal(getMessageRentStatus([
    { leaseId: 22, overdueAmount: 0, rentDue: 0, currentMonthExpected: 1200 },
    { leaseId: lease, overdueAmount: 2390, rentDue: 2390, currentMonthExpected: 1200 }
  ], lease).label, 'Overdue');
});

test('shows paid after settlement, but not for an installment still due', () => {
  assert.equal(getMessageRentStatus([{ LeaseId: lease, OverdueAmount: 0, RentDue: 0, CurrentMonthExpected: 1200 }], lease).label, 'Paid');
  assert.equal(getMessageRentStatus([{ leaseId: lease, overdueAmount: 0, rentDue: 1200, currentMonthExpected: 1200 }], lease).label, 'Payment due');
  assert.equal(getMessageRentStatus([{ leaseId: lease, overdueAmount: 0, rentDue: 0, currentMonthExpected: 0 }], lease).label, 'No rent due');
});

test('does not label missing or malformed balances paid', () => {
  for (const records of [null, [], [{ leaseId: lease, overdueAmount: 'bad', rentDue: 0, currentMonthExpected: 1200 }],
    [{ leaseId: lease, rentDue: 0, currentMonthExpected: 1200 }]]) {
    assert.equal(getMessageRentStatus(records, lease).label, 'Unavailable');
  }
});
