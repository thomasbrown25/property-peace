import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPaymentCsvRows,
  getPaymentReference,
  getPaymentType,
  isOnlinePayment,
  maskPaymentMetricsAvailability,
  normalizePaymentStatus,
  selectPaymentsPage
} from './paymentsTab.js';

const payments = [
  {
    Id: 1,
    PropertyId: 10,
    PaymentDate: '2026-08-01T00:00:00.000Z',
    Amount: 1200,
    Status: 'Paid',
    TenantName: 'Ada Tenant',
    PropertyName: 'Maple House',
    UnitName: '1A',
    Reference: 'August rent - Amount: $1,200.00',
    StripePaymentIntentId: 'pi_123'
  },
  {
    id: 2,
    propertyId: 10,
    paymentDate: '2026-08-15T12:00:00.000Z',
    amount: 75,
    status: 'failed',
    tenantName: 'Ben Tenant',
    propertyName: 'Maple House',
    unitName: '1B',
    feeId: 8,
    feeName: 'Late fee',
    method: 'Check'
  },
  {
    id: 3,
    propertyId: 20,
    paymentDate: '2026-08-31T23:59:59.999Z',
    amount: 500,
    status: 'disputed',
    propertyName: 'Oak Flats',
    depositId: 4,
    reference: ''
  },
  {
    id: 4,
    propertyId: 10,
    paymentDate: '2026-09-01T00:00:00.000Z',
    amount: 300,
    status: 'processing',
    propertyName: 'Maple House'
  }
];

test('payment normalization preserves legacy status, type, source, and reference semantics', () => {
  assert.deepEqual(
    ['completed', 'Succeeded', 'paid', 'failed', 'disputed', 'canceled', 'cancelled', 'pending'].map((status) => normalizePaymentStatus({ status })),
    ['completed', 'completed', 'completed', 'failed', 'disputed', 'canceled', 'canceled', 'processing']
  );
  assert.equal(getPaymentType(payments[0]), 'rent');
  assert.equal(getPaymentType(payments[1]), 'fee');
  assert.equal(getPaymentType(payments[2]), 'deposit');
  assert.equal(isOnlinePayment(payments[0]), true);
  assert.equal(isOnlinePayment(payments[1]), false);
  assert.equal(getPaymentReference(payments[0]), 'August rent');
  assert.equal(getPaymentReference(payments[1]), 'Late fee');
  assert.equal(getPaymentReference(payments[2]), 'Security deposit');
});

test('payment selection applies property and half-open period scope before client filters', () => {
  const selected = selectPaymentsPage(payments, {
    propertyId: 10,
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    page: 1,
    pageSize: 10
  });

  assert.equal(selected.unfilteredCount, 2);
  assert.deepEqual(selected.filteredPayments.map((payment) => payment.Id ?? payment.id), [2, 1]);
  assert.equal(selected.filteredPayments.some((payment) => (payment.Id ?? payment.id) === 4), false);
});

test('payment selection retains failed and disputed records while filtering and sorting editable rows', () => {
  const selected = selectPaymentsPage(payments, {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    search: 'house',
    type: 'all',
    status: 'attention',
    source: 'manual',
    sort: 'amount-high',
    page: 1,
    pageSize: 10
  });

  assert.deepEqual(selected.filteredPayments.map((payment) => payment.Id ?? payment.id), [2]);

  const allAttention = selectPaymentsPage(payments, {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    status: 'attention',
    sort: 'amount-high'
  });
  assert.deepEqual(allAttention.filteredPayments.map((payment) => payment.Id ?? payment.id), [3, 2]);
});

test('payment selection clamps pagination and CSV includes the full filtered sorted result', () => {
  const selected = selectPaymentsPage(payments.slice(0, 3), {
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    sort: 'amount-low',
    page: 99,
    pageSize: 2
  });

  assert.equal(selected.page, 2);
  assert.deepEqual(selected.visiblePayments.map((payment) => payment.Id ?? payment.id), [1]);
  const csv = buildPaymentCsvRows(selected.filteredPayments);
  assert.equal(csv.length, 3);
  assert.deepEqual(csv.map((row) => row.Amount), [75, 500, 1200]);
  assert.deepEqual(csv.map((row) => row.Status), ['Failed', 'Disputed', 'Completed']);
});

test('payment availability masks only payment-dependent overview metrics and recovers without changing values', () => {
  const overview = {
    cameIn: 2000,
    wentOut: 800,
    recordedNetCashFlow: 1200,
    fieldAvailability: { cameIn: true, wentOut: true, recordedNetCashFlow: true }
  };

  assert.deepEqual(maskPaymentMetricsAvailability(overview, false), {
    ...overview,
    fieldAvailability: { cameIn: false, wentOut: true, recordedNetCashFlow: false }
  });
  assert.equal(maskPaymentMetricsAvailability(overview, true), overview);
});
