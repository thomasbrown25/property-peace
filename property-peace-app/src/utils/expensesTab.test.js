import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExpenseCsvRows,
  buildExpenseHookFilters,
  maskExpenseMetricsAvailability,
  selectExpensesPage
} from './expensesTab.js';

test('expense hook filters translate shared half-open dates without mutating the URL scope', () => {
  const customScope = {
    propertyId: 12,
    sharedFrom: '2026-08-01T00:00:00.000Z',
    sharedTo: '2026-09-01T00:00:00.000Z',
    mutationVersion: 4
  };
  const currentDayScope = {
    propertyId: undefined,
    sharedFrom: '2026-08-01T00:00:00.000Z',
    sharedTo: '2026-08-25T12:30:00.000Z',
    mutationVersion: 5
  };

  assert.deepEqual(buildExpenseHookFilters(customScope), {
    propertyId: 12,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    mutationVersion: 4
  });
  assert.deepEqual(buildExpenseHookFilters(currentDayScope), {
    propertyId: null,
    startDate: '2026-08-01',
    endDate: '2026-08-25',
    mutationVersion: 5
  });
  assert.deepEqual(customScope, {
    propertyId: 12,
    sharedFrom: '2026-08-01T00:00:00.000Z',
    sharedTo: '2026-09-01T00:00:00.000Z',
    mutationVersion: 4
  });
});

test('expense selection enforces shared scope plus search, category, status, receipt, deductible, and sort filters', () => {
  const expenses = [
    { id: 1, propertyId: 12, expenseDate: '2026-08-04', name: 'Roof patch', vendor: 'Oak Supply', category: 'Repairs', amount: 80, isPaid: false, isTaxDeductible: true, receipts: [] },
    { id: 2, propertyId: 12, expenseDate: '2026-08-05', name: 'Hall lights', vendor: 'Bright Co', category: 'Utilities', amount: 20, isPaid: true, receipts: [{ id: 90 }] },
    { id: 3, propertyId: 13, expenseDate: '2026-08-06', name: 'Other property roof', category: 'Repairs', amount: 200, isPaid: true },
    { id: 4, propertyId: 12, expenseDate: '2026-07-31', name: 'Before range', category: 'Repairs', amount: 40, isPaid: true },
    { id: 5, propertyId: 12, expenseDate: '2026-09-01', name: 'Exclusive end', category: 'Repairs', amount: 50, isPaid: true }
  ];
  const scope = { propertyId: 12, from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z', pageSize: 10 };

  assert.deepEqual(selectExpensesPage(expenses, { ...scope, search: 'oak', category: 'Repairs', status: 'unpaid', sort: 'amount-high', page: 1 }).visibleExpenses.map((item) => item.id), [1]);
  assert.deepEqual(selectExpensesPage(expenses, { ...scope, status: 'paid', sort: 'newest', page: 1 }).visibleExpenses.map((item) => item.id), [2]);
  assert.deepEqual(selectExpensesPage(expenses, { ...scope, status: 'tax', sort: 'newest', page: 1 }).visibleExpenses.map((item) => item.id), [1]);
  assert.deepEqual(selectExpensesPage(expenses, { ...scope, status: 'missing-receipt', sort: 'newest', page: 1 }).visibleExpenses.map((item) => item.id), [1]);
});

test('expense pagination clamps after deletion or filter changes', () => {
  const expenses = Array.from({ length: 11 }, (_, index) => ({
    id: index + 1,
    propertyId: 12,
    expenseDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
    name: `Expense ${index + 1}`,
    category: 'Repairs',
    amount: index + 1,
    isPaid: true
  }));
  const filter = { propertyId: 12, from: '2026-08-01T00:00:00.000Z', to: '2026-09-01T00:00:00.000Z', status: 'all', sort: 'oldest', page: 3, pageSize: 10 };

  const beforeDelete = selectExpensesPage(expenses, filter);
  const afterDelete = selectExpensesPage(expenses.slice(0, 10), filter);

  assert.equal(beforeDelete.page, 2);
  assert.equal(beforeDelete.totalPages, 2);
  assert.deepEqual(beforeDelete.visibleExpenses.map((item) => item.id), [11]);
  assert.equal(afterDelete.page, 1);
  assert.equal(afterDelete.totalPages, 1);
  assert.deepEqual(afterDelete.visibleExpenses.map((item) => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('visible expense CSV rows retain receipt-independent accounting fields', () => {
  assert.deepEqual(buildExpenseCsvRows([{
    id: 8,
    expenseDate: '2026-08-04',
    name: 'Roof patch',
    category: 'Repairs',
    propertyName: 'Oak House',
    unitName: 'Unit 2',
    vendor: 'Oak Supply',
    isPaid: false,
    isTaxDeductible: true,
    amount: '80.50'
  }]), [{
    Date: 'Aug 4, 2026',
    Name: 'Roof patch',
    Category: 'Repairs',
    Property: 'Oak House',
    Unit: 'Unit 2',
    Vendor: 'Oak Supply',
    Status: 'Unpaid',
    TaxDeductible: 'Yes',
    Amount: 80.5
  }]);
});

test('unavailable editable expenses suppress only expense-dependent overview metrics', () => {
  const overview = {
    cameIn: 500,
    wentOut: 120,
    recordedNetCashFlow: 380,
    fieldAvailability: { cameIn: true, wentOut: true, recordedNetCashFlow: true }
  };

  assert.deepEqual(maskExpenseMetricsAvailability(overview, false), {
    cameIn: 500,
    wentOut: 120,
    recordedNetCashFlow: 380,
    fieldAvailability: { cameIn: true, wentOut: false, recordedNetCashFlow: false }
  });
  assert.equal(maskExpenseMetricsAvailability(overview, true), overview);
  assert.equal(maskExpenseMetricsAvailability(null, false), null);
});
