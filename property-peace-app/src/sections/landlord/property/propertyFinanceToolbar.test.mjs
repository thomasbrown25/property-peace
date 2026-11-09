import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property finance search fills remaining toolbar width without duplicate overview actions', async () => {
  const source = await read('./PropertyFinanceTable.jsx');
  const toolbar = source.slice(source.indexOf('<Stack direction={{ xs:', source.indexOf('<MainCard sx={financeSurfaceSx}>')), source.indexOf('<TableContainer'));
  assert.match(toolbar, /direction=\{\{ xs: 'column', sm: 'row' \}\}/);
  assert.match(toolbar, /<TextField[\s\S]*sx=\{\{ flex: 1, minWidth: 0 \}\}/);
  assert.doesNotMatch(toolbar, /maxWidth|\bml:|<Button/);
  assert.match(toolbar, /<TextField[\s\S]*<FormControl[\s\S]*<\/FormControl>/);
  assert.equal((source.match(/>Add Expense<\/Button>/g) || []).length, 1);
});

test('expense overview matches the compact payment label/value row and right-aligned action', async () => {
  const source = await read('./PropertyFinanceTable.jsx');
  const overview = source.slice(source.indexOf(') : ('), source.indexOf('<MainCard sx={financeSurfaceSx}>'));
  assert.match(overview, /justifyContent="space-between"/);
  assert.match(overview, /gridTemplateColumns: 'max-content minmax\(0, 1fr\)'/);
  assert.match(overview, /Monthly expenses:/);
  assert.match(overview, /Total expenses:/);
  assert.match(overview, /variant="body1" fontWeight=\{700\} color="error.main"/);
  assert.match(overview, /onClick=\{onAddExpense\}/);
  assert.match(overview, /alignSelf: \{ xs: 'flex-end', sm: 'center' \}, flexShrink: 0, whiteSpace: 'nowrap'/);
  assert.doesNotMatch(overview, /<MainCard|variant="h4"/);
});

test('payment overview keeps Record payment on the right and opens the property-scoped drawer', async () => {
  const source = await read('./PropertyFinanceTable.jsx');
  const overview = source.slice(source.indexOf('{isPayments ? ('), source.indexOf(') : ('));
  assert.match(overview, /justifyContent="space-between"/);
  assert.match(overview, /\{rentOverview\}[\s\S]*onClick=\{onRecordPayment\}/);
  assert.match(overview, /alignSelf: \{ xs: 'flex-end', sm: 'center' \}/);
  assert.equal((source.match(/>Record payment<\/Button>/g) || []).length, 1);
  const payments = await read('./PaymentsTab.jsx');
  assert.match(payments, /onRecordPayment=\{\(\) => drawer.openPaymentAddDrawer\(\{ property: property \|\| \{ id: propertyId \} \}\)\}/);
  assert.match(payments, /\[propertyId, attempt, drawer.financeMutationVersion\]/);
});

test('Expenses reuses the existing property expense handler and modal, while Payments is independent', async () => {
  const payments = await read('./PaymentsTab.jsx');
  const expenses = await read('./ExpensesTab.jsx');
  assert.doesNotMatch(payments, /ExpensesTab/);
  assert.match(expenses, /combined = true/);
  assert.match(expenses, /combined && !expensesError && <PropertyFinanceTable[\s\S]*?onAddExpense=\{handleAddExpense\}/);
  assert.match(expenses, /const handleAddExpense = \(\) => \{[\s\S]*?dispatch\(setUnit\(null\)\);\s*setEditingExpense\(null\);\s*setExpenseModalOpen\(true\)/);
  assert.match(expenses, /<ExpenseIncomeModal/);
});
