import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOnlineTransactionRows,
  filterOnlineTransactions,
  getOnlinePaymentMethodLabel,
  getOnlinePaymentStatusPresentation,
  summarizeOnlineTransactions
} from './onlinePaymentTransactions.js';

const transactions = [
  {
    paymentIntentId: 'pi_online_123456789',
    leaseId: 10,
    propertyId: 100,
    propertyName: 'Oak Terrace',
    unitName: '2B',
    tenantName: 'Jordan Lee',
    amountCents: 125000,
    currency: 'usd',
    status: 'succeeded',
    paidAt: '2026-08-25T11:58:00Z',
    processedAt: '2026-08-25T12:00:00Z',
    paymentMethodType: 'card',
    paymentMethodBrand: 'visa',
    paymentMethodLast4: '4242'
  },
  {
    paymentIntentId: 'pi_ach_987654321',
    leaseId: 11,
    propertyId: 200,
    propertyName: 'Pine House',
    tenantName: 'Sam Patel',
    amountCents: 90000,
    currency: 'usd',
    status: 'processing',
    paidAt: '2026-08-26T12:00:00Z',
    processedAt: null,
    paymentMethodType: 'us_bank_account',
    paymentMethodBankName: 'Chase',
    paymentMethodLast4: '6789'
  },
  {
    propertyId: 100,
    propertyName: 'Oak Terrace',
    tenantName: 'Manual Tenant',
    amountCents: 50000,
    status: 'completed'
  }
];

test('online transaction rows include only Stripe PaymentIntents and expose payment and processed dates', () => {
  const rows = buildOnlineTransactionRows(transactions);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    id: 'pi_ach_987654321',
    leaseId: 11,
    propertyId: 200,
    propertyName: 'Pine House',
    location: 'Pine House',
    tenant: 'Sam Patel',
    paidAt: '2026-08-26T12:00:00Z',
    processedAt: null,
    method: 'Chase bank •••• 6789',
    providerReference: 'pi_ach_987654321',
    status: 'processing',
    amount: 900,
    currency: 'USD'
  });
});

test('payment method labels use safe display metadata without exposing provider secrets', () => {
  assert.equal(getOnlinePaymentMethodLabel(transactions[0]), 'Visa •••• 4242');
  assert.equal(getOnlinePaymentMethodLabel(transactions[1]), 'Chase bank •••• 6789');
  assert.equal(getOnlinePaymentMethodLabel({ paymentMethodType: 'card' }), 'Card');
  assert.equal(getOnlinePaymentMethodLabel({}), 'Online payment');
});

test('online transactions can be searched and filtered by status and property', () => {
  assert.deepEqual(
    filterOnlineTransactions(transactions, { search: 'oak 4242', status: 'completed', propertyId: 100 }).map((row) => row.id),
    ['pi_online_123456789']
  );
  assert.deepEqual(filterOnlineTransactions(transactions, { propertyId: 200 }).map((row) => row.id), ['pi_ach_987654321']);
  assert.deepEqual(filterOnlineTransactions(transactions, { status: 'attention' }), []);
});

test('online transaction summary separates completed money from unsettled activity', () => {
  assert.deepEqual(summarizeOnlineTransactions(transactions), {
    totalCount: 2,
    completedAmount: 1250,
    processingCount: 1,
    attentionCount: 0,
    refundedCount: 0
  });
});

test('provider problem and refund states remain truthful', () => {
  const rows = buildOnlineTransactionRows([
    { ...transactions[0], paymentIntentId: 'pi_refunded', status: 'refunded' },
    { ...transactions[0], paymentIntentId: 'pi_partial', status: 'partially_refunded' },
    { ...transactions[0], paymentIntentId: 'pi_failed', status: 'requires_payment_method' }
  ]);

  assert.deepEqual(
    rows.map((row) => row.status),
    ['refunded', 'partially-refunded', 'failed']
  );
  assert.deepEqual(getOnlinePaymentStatusPresentation('refunded'), { label: 'Refunded', color: 'info' });
  assert.deepEqual(getOnlinePaymentStatusPresentation('partially-refunded'), { label: 'Partially refunded', color: 'info' });
});
