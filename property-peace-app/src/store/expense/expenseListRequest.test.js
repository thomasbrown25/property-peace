import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import * as expenseSelectors from './expense.selector.js';
import { EXPENSE_ACTION_TYPES as TYPES } from './expense.types.js';
import { selectExpensesPage } from '../../utils/expensesTab.js';

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
const rootState = (expense) => ({ expense });

const selectRequest = (state, requestKey) => {
  assert.equal(typeof expenseSelectors.selectExpenseListRequest, 'function');
  return expenseSelectors.selectExpenseListRequest(rootState(state), requestKey);
};

test('late expense-list responses cannot overwrite a newer request for the same key', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 1, 'scope-a'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 2, 'scope-a'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'new' }], 2, 'scope-a'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'stale' }], 1, 'scope-a'));

  const request = selectRequest(state, 'scope-a');
  assert.deepEqual(request?.expenses, [{ id: 'new' }]);
  assert.equal(request?.requestId, 2);
  assert.equal(request?.loading, false);
});

test('concurrent expense scopes settle independently and retain legacy last-success selection', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 3, '44:{"startDate":"2026-08-01T00:00:00.000Z","endDate":"2026-08-31T23:59:59.000Z","propertyId":12}'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 4, '44:{}'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'all-expense' }], 4, '44:{}'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'monthly-expense' }], 3, '44:{"startDate":"2026-08-01T00:00:00.000Z","endDate":"2026-08-31T23:59:59.000Z","propertyId":12}'));

  const dashboardRequest = selectRequest(state, '44:{"startDate":"2026-08-01T00:00:00.000Z","endDate":"2026-08-31T23:59:59.000Z","propertyId":12}');
  const cardRequest = selectRequest(state, '44:{}');
  assert.deepEqual(dashboardRequest?.expenses, [{ id: 'monthly-expense' }]);
  assert.equal(dashboardRequest?.loading, false);
  assert.equal(dashboardRequest?.error, null);
  assert.deepEqual(cardRequest?.expenses, [{ id: 'all-expense' }]);
  assert.equal(cardRequest?.loading, false);
  assert.equal(cardRequest?.error, null);
  assert.deepEqual(expenseSelectors.selectExpenses(rootState(state)), [{ id: 'all-expense' }]);
});

test('unkeyed expense-list actions preserve legacy singleton selectors', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, { type: TYPES.GET_EXPENSES_START });
  assert.equal(expenseSelectors.selectExpenseListLoading(rootState(state)), true);
  state = expenseReducer(state, { type: TYPES.GET_EXPENSES_SUCCESS, payload: [{ id: 'legacy-expense' }] });

  assert.deepEqual(expenseSelectors.selectExpenses(rootState(state)), [{ id: 'legacy-expense' }]);
  assert.equal(expenseSelectors.selectExpenseListLoading(rootState(state)), false);
  assert.equal(expenseSelectors.selectExpenseListError(rootState(state)), null);
});
test('total and receipt operations cannot mask a keyed expense-list failure', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 5, 'scope-c'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_FAILURE, 'list failed', 5, 'scope-c'));
  state = expenseReducer(state, { type: TYPES.GET_TOTAL_EXPENSES_SUCCESS, payload: 42 });
  state = expenseReducer(state, { type: TYPES.GET_EXPENSE_RECEIPTS_START });
  state = expenseReducer(state, { type: TYPES.GET_EXPENSE_RECEIPTS_FAILURE, payload: 'receipt failed' });

  const request = selectRequest(state, 'scope-c');
  assert.equal(request?.loading, false);
  assert.equal(request?.error, 'list failed');
  assert.deepEqual(request?.expenses, []);
});

test('same-scope mutation refresh retains page data until refreshed deletion results can clamp', () => {
  const originalExpenses = Array.from({ length: 11 }, (_, index) => ({
    id: index + 1,
    propertyId: 12,
    expenseDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
    name: `Expense ${index + 1}`,
    category: 'Repairs',
    amount: index + 1,
    isPaid: true
  }));
  const pageFilter = {
    propertyId: 12,
    from: '2026-08-01T00:00:00.000Z',
    to: '2026-09-01T00:00:00.000Z',
    status: 'all',
    sort: 'oldest',
    page: 2,
    pageSize: 10
  };

  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 6, 'finances-property-period'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, originalExpenses, 6, 'finances-property-period'));
  state = expenseReducer(state, { type: TYPES.DELETE_EXPENSE_SUCCESS, payload: 11 });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 7, 'finances-property-period'));

  const refreshingRequest = selectRequest(state, 'finances-property-period');
  const duringRefresh = selectExpensesPage(refreshingRequest?.expenses, pageFilter);
  assert.equal(refreshingRequest?.loading, true);
  assert.deepEqual(refreshingRequest?.expenses.map((expense) => expense.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(duringRefresh.page, 2);
  assert.deepEqual(duringRefresh.visibleExpenses.map((expense) => expense.id), [11]);

  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, originalExpenses.slice(0, 10), 7, 'finances-property-period'));
  const refreshedRequest = selectRequest(state, 'finances-property-period');
  const afterRefresh = selectExpensesPage(refreshedRequest?.expenses, pageFilter);
  assert.equal(refreshedRequest?.loading, false);
  assert.equal(afterRefresh.page, 1);
  assert.deepEqual(afterRefresh.visibleExpenses.map((expense) => expense.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
