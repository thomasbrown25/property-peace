import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { EXPENSE_ACTION_TYPES as TYPES } from './expense.types.js';

const reducerSource = await readFile(new URL('./expense.reducer.js', import.meta.url), 'utf8');
const executableSource = reducerSource.replace(
  /import \{ EXPENSE_ACTION_TYPES \} from '\.\/expense\.types';/,
  `const EXPENSE_ACTION_TYPES = ${JSON.stringify(TYPES)};`
);
const { default: expenseReducer } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(executableSource)}`);

const action = (type, payload, requestId, requestKey) => ({
  type,
  ...(payload === undefined ? {} : { payload }),
  meta: { requestId, requestKey }
});

test('late expense-list responses cannot overwrite the active request', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 1, 'scope-a'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 2, 'scope-b'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'new' }], 2, 'scope-b'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'stale' }], 1, 'scope-a'));

  assert.deepEqual(state.expenses, [{ id: 'new' }]);
  assert.equal(state.listRequestId, 2);
  assert.equal(state.listSettledRequestKey, 'scope-b');
});

test('total and receipt operations cannot mask an expense-list failure', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 3, 'scope-c'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_FAILURE, 'list failed', 3, 'scope-c'));
  state = expenseReducer(state, { type: TYPES.GET_TOTAL_EXPENSES_SUCCESS, payload: 42 });
  state = expenseReducer(state, { type: TYPES.GET_EXPENSE_RECEIPTS_START });
  state = expenseReducer(state, { type: TYPES.GET_EXPENSE_RECEIPTS_FAILURE, payload: 'receipt failed' });

  assert.equal(state.listLoading, false);
  assert.equal(state.listError, 'list failed');
  assert.equal(state.listSettledRequestKey, 'scope-c');
  assert.deepEqual(state.expenses, []);
});
