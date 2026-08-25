import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFile(path.join(srcRoot, relativePath), 'utf8');

test('global finance drawers signal only successful mutations', async () => {
  const drawerControls = await source('hooks/useDrawerControls.js');
  const dashboard = await source('layout/Dashboard/index.jsx');

  assert.match(drawerControls, /const \[financeMutationVersion, setFinanceMutationVersion\] = useState\(0\);/);
  assert.match(drawerControls, /const notifyFinanceMutation = useCallback\(\(\) => \{\s*setFinanceMutationVersion\(\(version\) => version \+ 1\);\s*\}, \[\]\);/);
  assert.match(drawerControls, /return \{[\s\S]*?financeMutationVersion,[\s\S]*?notifyFinanceMutation,/);
  assert.match(dashboard, /<RecordPaymentDrawer\s+onSuccess=\{drawer\.notifyFinanceMutation\}\s*\/>/);
  assert.match(
    dashboard,
    /<ExpenseAddDrawer\s+open=\{drawer\.isOpenExpenseAdd\}\s+onClose=\{drawer\.closeExpenseAddDrawer\}\s+onSuccess=\{drawer\.notifyFinanceMutation\}\s+initialSelection=\{drawer\.expenseAddInitialSelection\}\s*\/>/
  );
});

test('expense success navigation uses the canonical finances expenses destination', async () => {
  const expenseDrawer = await source('components/expense/ExpenseAddDrawer.jsx');

  assert.doesNotMatch(expenseDrawer, /\/landlord\/accounting\?tab=1/);
  assert.match(expenseDrawer, /navigate\('\/landlord\/finances\?tab=expenses'\)/);
});

test('composite expense drawers invalidate only after their receipt work and immediately before success', async () => {
  const addDrawer = await source('components/expense/ExpenseAddDrawer.jsx');
  const editDrawer = await source('components/expense/ExpenseEditDrawer.jsx');

  assert.equal((addDrawer.match(/\{ invalidateLists: false \}/g) || []).length, 4, 'every core add in the composite drawer defers invalidation');
  assert.equal((editDrawer.match(/\{ invalidateLists: false \}/g) || []).length, 1, 'the core edit defers invalidation');
  assert.match(
    addDrawer,
    /uploadExpenseReceiptsAction[\s\S]*?await runCompositeExpenseMutation\(dispatch, createCompositeExpense\);\s*onSuccess\?\.\(\);/
  );
  assert.match(
    editDrawer,
    /deleteExpenseReceiptAction[\s\S]*?uploadExpenseReceiptsAction[\s\S]*?await runCompositeExpenseMutation\(dispatch, updateCompositeExpense\);\s*await onSuccess\?\.\(\);/
  );
});
