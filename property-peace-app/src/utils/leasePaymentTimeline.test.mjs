import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLeasePaymentTimeline } from './leasePaymentTimeline.js';

const lease = {
  startDate: '2026-01-01', endDate: '2026-04-30', rentAmount: 1000,
  rentDueDay: 1, lateFeeGracePeriod: 5
};
const payment = (date, amount = 1000, extra = {}) => ({ paymentDate: date, amount, ...extra });

test('shows the entire lease with on-time, late, overdue and future installments', () => {
  const result = buildLeasePaymentTimeline(lease, [
    payment('2026-01-06', 400), payment('2026-01-06', 600),
    payment('2026-02-07'), payment('2026-01-03', 500, { type: 'deposit' }),
    payment('2026-03-02', 1000, { status: 'pending' })
  ], new Date(2026, 2, 10));
  assert.deepEqual(result.map((cycle) => cycle.status), ['on-time', 'late', 'overdue', 'upcoming']);
  assert.deepEqual(result.map((cycle) => cycle.dueDate), ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']);
});

test('grace boundary, draft leases and missing schedule are safe', () => {
  assert.equal(buildLeasePaymentTimeline(lease, [], new Date(2026, 0, 6))[0].status, 'upcoming');
  assert.equal(buildLeasePaymentTimeline(lease, [], new Date(2026, 0, 7))[0].status, 'overdue');
  assert.ok(buildLeasePaymentTimeline(lease, [], new Date(2026, 3, 30), true).every((cycle) => cycle.status === 'upcoming'));
  assert.deepEqual(buildLeasePaymentTimeline({ startDate: '2026-01-01' }), []);
});

test('long leases include every scheduled month beyond the list-page twelve-tile preview', () => {
  const longLease = { ...lease, endDate: '2027-12-31' };
  const result = buildLeasePaymentTimeline(longLease, [], new Date(2026, 0, 1));
  assert.equal(result.length, 24);
  assert.equal(result.at(-1).dueDate, '2027-12-01');
});

test('prorated installments are accounted for before full-rent milestones', () => {
  const prorated = { ...lease, startDate: '2026-01-15', endDate: '2026-03-31', proratedRentDue: true, proratedRentAmount: 500 };
  const result = buildLeasePaymentTimeline(prorated, [payment('2026-01-16', 500), payment('2026-02-10', 1000)], new Date(2026, 1, 20));
  assert.deepEqual(result.map((cycle) => cycle.status), ['on-time', 'late', 'upcoming']);
});
