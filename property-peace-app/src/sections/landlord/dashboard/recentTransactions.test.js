import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecentPayments } from './recentTransactions.js';

test('returns payment income only in newest-first order', () => {
  const payments = [
    {
      id: 11,
      paymentDate: '2026-08-05T10:00:00Z',
      amount: 1450,
      tenantName: 'Jordan Lee',
      propertyName: 'Maple House',
      unitName: 'Unit 2',
      propertyId: 7
    },
    {
      Id: 12,
      PaymentDate: '2026-08-07T10:00:00Z',
      Amount: 975,
      TenantName: 'Avery Chen',
      PropertyName: 'Oak Apartments',
      IsSingleUnitProperty: true
    }
  ];
  const expenses = [
    {
      id: 21,
      isPaid: true,
      paidDate: '2026-08-08T10:00:00Z',
      amount: 225,
      name: 'Plumbing repair'
    }
  ];

  assert.deepEqual(buildRecentPayments(payments, expenses), [
    {
      id: 'payment-12',
      kind: 'income',
      date: '2026-08-07T10:00:00Z',
      title: 'Oak Apartments',
      sub: 'Avery Chen',
      amount: 975,
      onClick: '/landlord/finances?tab=activity'
    },
    {
      id: 'payment-11',
      kind: 'income',
      date: '2026-08-05T10:00:00Z',
      title: 'Maple House',
      sub: 'Jordan Lee',
      amount: 1450,
      onClick: '/landlord/property/7'
    }
  ]);
});

test('leaves tenant context blank instead of showing an unavailable placeholder', () => {
  const [result] = buildRecentPayments([
    {
      id: 13,
      paymentDate: '2026-08-08T10:00:00Z',
      amount: 1200,
      propertyName: 'Shannon House Property'
    }
  ]);

  assert.equal(result.title, 'Shannon House Property');
  assert.equal(result.sub, '');
});

test('returns only the six most recent payments', () => {
  const payments = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    paymentDate: `2026-08-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
    amount: 100,
    propertyName: `Property ${index + 1}`
  }));

  const result = buildRecentPayments(payments);

  assert.equal(result.length, 6);
  assert.deepEqual(
    result.map((item) => item.id),
    ['payment-8', 'payment-7', 'payment-6', 'payment-5', 'payment-4', 'payment-3']
  );
  assert.ok(result.every((item) => item.kind === 'income'));
});
