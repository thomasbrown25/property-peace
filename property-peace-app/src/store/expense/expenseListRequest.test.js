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
const scopeAction = (type, requestKey) => ({ type, meta: { requestKey } });

const selectRequest = (state, requestKey) => {
  assert.equal(typeof expenseSelectors.selectExpenseListRequest, 'function');
  return expenseSelectors.selectExpenseListRequest(rootState(state), requestKey);
};

const createMountedScopeState = () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  const dashboardKey = '44:{"startDate":"2026-08-01","endDate":"2026-08-31","propertyId":12}';
  const paymentsCardKey = '44:{}';
  state = expenseReducer(state, scopeAction(TYPES.REGISTER_EXPENSE_LIST_SCOPE, dashboardKey));
  state = expenseReducer(state, scopeAction(TYPES.REGISTER_EXPENSE_LIST_SCOPE, paymentsCardKey));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 40, dashboardKey));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 1, name: 'Monthly expense' }], 40, dashboardKey));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 41, paymentsCardKey));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 1, name: 'All expense' }], 41, paymentsCardKey));
  return { state, dashboardKey, paymentsCardKey };
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

test('add, update, and delete successes invalidate every mounted scope until each refresh is claimed', () => {
  const mutations = [
    { type: TYPES.ADD_EXPENSE_SUCCESS, payload: { id: 2, name: 'Added' } },
    { type: TYPES.UPDATE_EXPENSE_SUCCESS, payload: { id: 1, name: 'Updated' } },
    { type: TYPES.DELETE_EXPENSE_SUCCESS, payload: 1 }
  ];

  for (const mutation of mutations) {
    const mounted = createMountedScopeState();
    let state = expenseReducer(mounted.state, mutation);

    assert.equal(selectRequest(state, mounted.dashboardKey)?.stale, true, mutation.type + ' invalidates Dashboard');
    assert.equal(selectRequest(state, mounted.paymentsCardKey)?.stale, true, mutation.type + ' invalidates PaymentsCard');
    assert.deepEqual(selectRequest(state, mounted.dashboardKey)?.expenses, [{ id: 1, name: 'Monthly expense' }]);
    assert.deepEqual(selectRequest(state, mounted.paymentsCardKey)?.expenses, [{ id: 1, name: 'All expense' }]);

    state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 50, mounted.dashboardKey));
    assert.equal(selectRequest(state, mounted.dashboardKey)?.stale, false, 'explicit start claims Dashboard refresh');
    assert.equal(selectRequest(state, mounted.dashboardKey)?.loading, true);
    assert.equal(selectRequest(state, mounted.paymentsCardKey)?.stale, true, 'other scope still requires refresh');

    state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 51, mounted.paymentsCardKey));
    assert.equal(selectRequest(state, mounted.paymentsCardKey)?.stale, false, 'explicit start claims PaymentsCard refresh');
    assert.equal(selectRequest(state, mounted.paymentsCardKey)?.loading, true);
  }
});

test('failed add, update, and delete mutations do not invalidate mounted scopes', () => {
  for (const type of [TYPES.ADD_EXPENSE_FAILURE, TYPES.UPDATE_EXPENSE_FAILURE, TYPES.DELETE_EXPENSE_FAILURE]) {
    const mounted = createMountedScopeState();
    const state = expenseReducer(mounted.state, { type, payload: 'mutation failed' });

    assert.equal(selectRequest(state, mounted.dashboardKey)?.stale, false, type + ' leaves Dashboard current');
    assert.equal(selectRequest(state, mounted.paymentsCardKey)?.stale, false, type + ' leaves PaymentsCard current');
  }
});

test('a mutation during an existing list request remains stale after that old request settles', () => {
  const mounted = createMountedScopeState();
  let state = expenseReducer(mounted.state, action(TYPES.GET_EXPENSES_START, undefined, 60, mounted.dashboardKey));
  state = expenseReducer(state, { type: TYPES.ADD_EXPENSE_SUCCESS, payload: { id: 2, name: 'Added' } });
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 1, name: 'Pre-mutation response' }], 60, mounted.dashboardKey));

  assert.equal(selectRequest(state, mounted.dashboardKey)?.loading, false);
  assert.equal(selectRequest(state, mounted.dashboardKey)?.stale, true);
});

test('scope registrations retain shared consumers and release the final cache entry safely', () => {
  let state = expenseReducer(undefined, { type: 'test/init' });
  state = expenseReducer(state, scopeAction(TYPES.REGISTER_EXPENSE_LIST_SCOPE, 'shared-scope'));
  state = expenseReducer(state, scopeAction(TYPES.REGISTER_EXPENSE_LIST_SCOPE, 'shared-scope'));
  state = expenseReducer(state, scopeAction(TYPES.REGISTER_EXPENSE_LIST_SCOPE, 'loading-scope'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 70, 'shared-scope'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'shared' }], 70, 'shared-scope'));
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_START, undefined, 71, 'loading-scope'));

  state = expenseReducer(state, scopeAction(TYPES.RELEASE_EXPENSE_LIST_SCOPE, 'shared-scope'));
  assert.deepEqual(selectRequest(state, 'shared-scope')?.expenses, [{ id: 'shared' }]);
  assert.equal(state.listRequestRefCounts['shared-scope'], 1);

  state = expenseReducer(state, scopeAction(TYPES.RELEASE_EXPENSE_LIST_SCOPE, 'shared-scope'));
  assert.equal(selectRequest(state, 'shared-scope'), null);
  assert.equal(state.listRequestRefCounts['shared-scope'], undefined);

  state = expenseReducer(state, scopeAction(TYPES.RELEASE_EXPENSE_LIST_SCOPE, 'loading-scope'));
  assert.equal(selectRequest(state, 'loading-scope'), null);
  state = expenseReducer(state, action(TYPES.GET_EXPENSES_SUCCESS, [{ id: 'late' }], 71, 'loading-scope'));
  assert.equal(selectRequest(state, 'loading-scope'), null, 'late response cannot recreate a released scope');
  assert.equal(expenseSelectors.selectExpenseListLoading(rootState(state)), false, 'released latest response still settles legacy loading');
  assert.deepEqual(expenseSelectors.selectExpenses(rootState(state)), [{ id: 'late' }]);
  assert.deepEqual(Object.keys(state.listRequestsByKey), []);
  assert.deepEqual(Object.keys(state.listRequestRefCounts), []);
});
