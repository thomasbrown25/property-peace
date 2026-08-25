import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecentTransactions } from './recentTransactions.js';

test('combines paid income and expenses in newest-first order', () => {
  const payments = [
    {
      id: 11,
      paymentDate: '2026-08-05T10:00:00Z',
      amount: 1450,
      propertyName: 'Maple House',
      unitName: 'Unit 2',
      propertyId: 7
    }
  ];
  const expenses = [
    {
      Id: 21,
      IsPaid: true,
      PaidDate: '2026-08-07T10:00:00Z',
      Amount: 225,
      Name: 'Plumbing repair',
      PropertyName: 'Maple House',
      UnitName: 'Unit 2'
    },
    {
      id: 22,
      isPaid: false,
      expenseDate: '2026-08-08T10:00:00Z',
      amount: 90,
      name: 'Unpaid invoice'
    }
  ];

  assert.deepEqual(buildRecentTransactions(payments, expenses), [
    {
      id: 'expense-21',
      kind: 'expense',
      date: '2026-08-07T10:00:00Z',
      title: 'Plumbing repair',
      sub: 'Maple House · Unit 2',
      amount: 225,
      onClick: '/landlord/finances?tab=expenses'
    },
    {
      id: 'payment-11',
      kind: 'income',
      date: '2026-08-05T10:00:00Z',
      title: 'Maple House · Unit 2',
      sub: 'Rent payment',
      amount: 1450,
      onClick: '/landlord/property/7'
    }
  ]);
});

test('returns only the six most recent transactions across both types', () => {
  const payments = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    paymentDate: `2026-08-0${index + 1}T10:00:00Z`,
    amount: 100,
    propertyName: `Property ${index + 1}`
  }));
  const expenses = Array.from({ length: 4 }, (_, index) => ({
    id: index + 10,
    isPaid: true,
    paidDate: `2026-08-0${index + 5}T10:00:00Z`,
    amount: 50,
    name: `Expense ${index + 1}`
  }));

  const result = buildRecentTransactions(payments, expenses);

  assert.equal(result.length, 6);
  assert.equal(result[0].sub, '');
  assert.deepEqual(result.map((item) => item.id), ['expense-13', 'expense-12', 'expense-11', 'expense-10', 'payment-4', 'payment-3']);
  assert.equal(result.at(-1).onClick, '/landlord/finances?tab=activity');
});
