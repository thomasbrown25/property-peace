import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { combinePropertyFinances, financeUnitName, hasFinanceUnits, paymentCategory } from './propertyFinances.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('property records are sorted newest first and exclude other properties', () => {
  const payments = [{ id: 1, amount: 100, paymentDate: '2026-01-02', propertyId: 7 }, { id: 2, amount: 50, paymentDate: '2026-01-04', propertyId: 8 }];
  const expenses = [{ id: 3, amount: 20, expenseDate: '2026-01-03', propertyId: '7', isPaid: false }];
  assert.deepEqual(combinePropertyFinances(payments, [], 7).map(row => row.record.id), [1]);
  assert.deepEqual(combinePropertyFinances([], expenses, 7).map(row => row.record.id), [3]);
  const rows = combinePropertyFinances(payments, expenses, 7);
  assert.deepEqual(rows.map(row => row.record.id), [3, 1]);
});

test('unit column is hidden for detached single units and shown for multi-unit types', () => {
  for (const propertyType of ['SingleFamily', 'SingleUnit', 'Townhouse', 'Condominium']) assert.equal(hasFinanceUnits({ propertyType, units: [{ id: 1 }] }), false);
  for (const propertyType of ['MultiFamily', 'Duplex', 'Apartment']) assert.equal(hasFinanceUnits({ propertyType, units: [{ id: 1 }] }), true);
  assert.equal(hasFinanceUnits({ propertyType: 'SingleFamily', units: [{ id: 1 }, { id: 2 }] }), true);
});

test('unit labels resolve direct names, lease names, property units and property-wide expenses', () => {
  const property = { units: [{ id: 3, name: 'Upstairs' }] };
  assert.equal(financeUnitName({ unitName: 'A' }, property), 'A');
  assert.equal(financeUnitName({ lease: { unitName: 'B' } }, property), 'B');
  assert.equal(financeUnitName({ unitId: '3' }, property), 'Upstairs');
  assert.equal(financeUnitName({ UnitId: 3 }, { Units: [{ Id: 3, Name: 'Upper' }] }), 'Upper');
  assert.equal(financeUnitName({ unitId: 4 }, property), 'Unit #4');
  assert.equal(financeUnitName({}, property), 'Property-wide');
});

test('rent, deposit and fee payments retain distinct categories', () => {
  assert.equal(paymentCategory({ depositId: 5 }), 'Deposit');
  assert.equal(paymentCategory({ type: 'deposit' }), 'Deposit');
  assert.equal(paymentCategory({ feeId: 1, feeName: 'Late fee' }), 'Late fee');
  assert.equal(paymentCategory({}), 'Rent payment');
});

test('property finances are separate tabs, with legacy links opening payments', async () => {
  const tabs = await read('./PropertyRecordsTabs.jsx');
  const payments = await read('./PaymentsTab.jsx');
  const expenses = await read('./ExpensesTab.jsx');
  const table = await read('./PropertyFinanceTable.jsx');
  assert.match(tabs, /value="payments" label="Payments"/);
  assert.match(tabs, /value="expenses" label="Expenses"/);
  assert.doesNotMatch(tabs, /value="finances"/);
  assert.match(tabs, /tab === 'finances' \? 'payments'/);
  assert.match(tabs, /active === 'payments' && <PaymentsTab/);
  assert.match(tabs, /active === 'expenses' && <ExpensesTab/);
  assert.match(payments, /mode="payments"/);
  assert.doesNotMatch(payments, /<ExpensesTab/);
  assert.match(expenses, /mode="expenses"/);
  assert.match(table, /combinePropertyFinances\(isPayments \? payments : \[\], isPayments \? \[\] : expenses, propertyId\)/);
  assert.match(table, /showUnit && <TableCell>Unit<\/TableCell>/);
  assert.match(table, /colSpan=\{columnCount\}/);
});

test('payments handle loading, failures, retries and stale property requests', async () => {
  const source = await read('./PaymentsTab.jsx');
  assert.match(source, /api\/payment\/all\?propertyId=\$\{encodeURIComponent\(propertyId\)\}/);
  assert.match(source, /new AbortController/);
  assert.match(source, /controller.signal.aborted/);
  assert.match(source, /result.propertyId !== propertyId/);
  assert.match(source, /controller.abort\(\)/);
  assert.match(source, /<Alert severity="error"/);
  assert.match(source, /setAttempt\(value => value \+ 1\)/);
});

test('expenses keep property-scoped future and recurring lists with matching unit columns', async () => {
  const source = await read('./ExpensesTab.jsx');
  assert.match(source, /scopePropertyRecords\(allRecurringExpenses, propertyId\)/);
  assert.match(source, /scopePropertyRecords\(allFutureExpenses, propertyId\)/);
  assert.match(source, /recurringExpensesExpanded, setRecurringExpensesExpanded\] = useState\(true\)/);
  assert.match(source, /Future & Recurring Expenses/);
  assert.match(source, /showUnit && <TableCell>\{financeUnitName\(recurring, property\)\}/);
  assert.match(source, /showUnit && <TableCell>\{financeUnitName\(future, property\)\}/);
  assert.match(source, /pauseRecurringExpenseAction/);
  assert.match(source, /resumeRecurringExpenseAction/);
});
