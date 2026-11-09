import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getMonthlyExpenses } from './monthlyExpenses.mjs';

const now = new Date(2026, 10, 8);
const recurring = overrides => ({ propertyId: 7, amount: 100, frequency: 'Monthly', dayOfPeriod: 15, startDate: '2026-01-15', ...overrides });
const total = overrides => getMonthlyExpenses({ propertyId: 7, now, ...overrides });

test('includes full-month recorded and scheduled costs, independently of payment status', () => {
  assert.equal(total({
    expenses: [
      { propertyId: 7, amount: '40', expenseDate: '2026-11-01', isPaid: true },
      { propertyId: 7, amount: 20, expenseDate: '2026-11-30', isPaid: false },
      { propertyId: 7, amount: 999, expenseDate: '2026-10-31' },
      { propertyId: 8, amount: 999, expenseDate: '2026-11-01' }
    ],
    recurringExpenses: [recurring()],
    futureExpenses: [{ propertyId: 7, amount: 30, dueDate: '2026-11-30' }, { propertyId: 7, amount: 999, dueDate: '2026-12-01' }]
  }), 190);
});

test('generated recurrence is counted as the actual expense, not again as a forecast', () => {
  assert.equal(total({
    expenses: [{ propertyId: 7, amount: 100, expenseDate: '2026-11-01' }],
    recurringExpenses: [recurring({ dayOfPeriod: 1, lastGeneratedDate: '2026-11-01', nextOccurrenceDate: '2026-12-01' })]
  }), 100);
});

test('paused, expired, future and out-of-property schedules are excluded', () => {
  assert.equal(total({ recurringExpenses: [
    recurring({ isPaused: true }), recurring({ endDate: '2026-11-14' }),
    recurring({ startDate: '2026-12-15' }), recurring({ propertyId: 8 }),
    recurring({ frequency: 'unknown' })
  ] }), 0);
});

test('quarterly and yearly expenses count only in their due month, not as monthly averages', () => {
  assert.equal(total({ recurringExpenses: [recurring({ frequency: 'Quarterly' }), recurring({ frequency: 'Yearly', startDate: '2025-11-15' })] }), 100);
  assert.equal(total({ now: new Date(2026, 9, 1), recurringExpenses: [recurring({ frequency: 1 })] }), 100);
});

test('clamps the day to month end and treats end dates as inclusive local business dates', () => {
  assert.equal(total({ now: new Date(2028, 1, 1), recurringExpenses: [recurring({ dayOfPeriod: 31, endDate: '2028-02-29' })] }), 100);
  assert.equal(total({ now: new Date(2028, 1, 1), recurringExpenses: [recurring({ dayOfPeriod: 31, endDate: '2028-02-28' })] }), 0);
});

test('bill due date takes priority over recorded date and includes month boundaries', () => {
  assert.equal(total({ expenses: [
    { propertyId: 7, amount: 10, expenseDate: '2026-10-15', dueDate: '2026-11-01T00:00:00' },
    { propertyId: 7, amount: 20, expenseDate: '2026-11-15', dueDate: '2026-12-01' },
    { PropertyId: 7, Amount: 30, ExpenseDate: '2026-11-30' }
  ] }), 40);
});

test('supports legacy recurring templates without counting their original expense date twice', () => {
  assert.equal(total({ expenses: [recurring({ isRecurring: true, expenseDate: '2026-11-01' })] }), 100);
});

test('empty data is a real zero', () => assert.equal(total({}), 0));

test('expenses overview wires unfiltered month totals and distinct loading/error states', () => {
  const tab = readFileSync(new URL('./ExpensesTab.jsx', import.meta.url), 'utf8');
  const table = readFileSync(new URL('./PropertyFinanceTable.jsx', import.meta.url), 'utf8');
  assert.match(tab, /getMonthlyExpenses\(\{ expenses: allExpenses \|\| \[\], recurringExpenses, futureExpenses, propertyId \}\)/);
  assert.match(table, /Monthly expenses:/);
  assert.match(table, /monthlyExpensesLoading \? 'Loading…'/);
  assert.match(table, /monthlyExpensesError \|\| monthlyExpenses == null \? '—'/);
});
