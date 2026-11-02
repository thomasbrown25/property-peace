import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { combinePropertyFinances } from './propertyFinances.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('combines property payments and expenses in date order without hiding either kind', () => {
  const payments = [{ id: 1, amount: 100, paymentDate: '2026-01-02', propertyId: 7 }, { id: 2, amount: 50, paymentDate: '2026-01-04', propertyId: 8 }];
  const expenses = [{ id: 3, amount: 20, expenseDate: '2026-01-03', propertyId: 7, isPaid: false }];
  const rows = combinePropertyFinances(payments, expenses, 7);
  assert.deepEqual(rows.map(row => row.kind), ['expense', 'income']);
  assert.deepEqual(rows.map(row => row.record.id), [3, 1]);
});

test('property finances have one table and keep future and recurring expenses underneath', async () => {
  const tabs = await read('./PropertyRecordsTabs.jsx');
  const income = await read('./IncomeTab.jsx');
  const expenses = await read('./ExpensesTab.jsx');
  const table = await read('./PropertyFinanceTable.jsx');
  assert.match(tabs, /<IncomeTab propertyId=\{propertyId\} property=\{property\}/);
  assert.doesNotMatch(tabs, /<ExpensesTab/);
  assert.doesNotMatch(income, /View all rental income and payments for this property/);
  assert.match(table, /Total Income/);
  assert.match(table, /Total Expenses/);
  assert.match(table, /combinePropertyFinances/);
  assert.match(expenses, /Future|futureExpenses/);
  assert.match(expenses, /Recurring|recurringExpenses/);
});
