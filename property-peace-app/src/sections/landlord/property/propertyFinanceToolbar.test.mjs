import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property finances search fills remaining toolbar width with Add immediately after the filter', async () => {
  const source = await read('./PropertyFinanceTable.jsx');
  const toolbar = source.slice(source.indexOf('<Stack direction={{ xs:'), source.indexOf('<TableContainer'));
  assert.match(toolbar, /direction=\{\{ xs: 'column', sm: 'row' \}\}/);
  assert.match(toolbar, /<TextField[\s\S]*sx=\{\{ flex: 1, minWidth: 0 \}\}/);
  assert.doesNotMatch(toolbar, /maxWidth|\bml:/);
  assert.match(toolbar, /<TextField[\s\S]*<FormControl[\s\S]*<\/FormControl>\s*<Button/);
  assert.match(toolbar, /onClick=\{onAddExpense\}/);
  assert.match(toolbar, /flexShrink: 0, whiteSpace: 'nowrap'/);
  assert.equal((source.match(/>Add Expense<\/Button>/g) || []).length, 1);
});

test('combined Finances reuses the existing property expense handler and modal without the legacy add header', async () => {
  const income = await read('./IncomeTab.jsx');
  const expenses = await read('./ExpensesTab.jsx');
  assert.match(income, /<ExpensesTab[^>]* combined\s*\/>/);
  assert.match(expenses, /combined && <PropertyFinanceTable[\s\S]*?onAddExpense=\{handleAddExpense\}/);
  assert.match(expenses, /!combined && <>[\s\S]*?Header with Add Button/);
  assert.match(expenses, /const handleAddExpense = \(\) => \{[\s\S]*?setEditingExpense\(null\);\s*setExpenseModalOpen\(true\)/);
  assert.match(expenses, /<ExpenseIncomeModal/);
});
