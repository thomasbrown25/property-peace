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
const expenseApi = {};
globalThis.__expenseListRequestTestApi = expenseApi;
const expenseActionSource = await readFile(new URL('./expense.action.js', import.meta.url), 'utf8');
const executableActionSource = expenseActionSource
  .replace("import { expenseAPI } from 'api';", 'const expenseAPI = globalThis.__expenseListRequestTestApi;')
  .replace(
    "import { buildExpenseListRequestKey } from 'utils/expensesTab';",
    "const buildExpenseListRequestKey = (landlordId, filters) => `${landlordId}:${JSON.stringify(filters)}`;"
  )
  .replace(
    /import \{ EXPENSE_ACTION_TYPES \} from '\.\/expense\.types';/,
    `const EXPENSE_ACTION_TYPES = ${JSON.stringify(TYPES)};`
  );
const expenseActions = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(executableActionSource)}`);

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
const createStore = (initialExpenseState) => {
  let expenseState = initialExpenseState;
  const dispatchedActions = [];
  const getState = () => ({ expense: expenseState });
  const dispatch = (dispatched) => {
    if (typeof dispatched === 'function') return dispatched(dispatch, getState);
    dispatchedActions.push(dispatched);
    expenseState = expenseReducer(expenseState, dispatched);
    return dispatched;
  };

  return {
    dispatch,
    get expenseState() {
      return expenseState;
    },
    dispatchedActions
  };
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

test('composite add waits for receipt settlement, invalidates once, and explicit refetch claims the stale scope', async () => {
  const mounted = createMountedScopeState();
  const store = createStore(mounted.state);
  let finishUpload;
  let signalUploadStarted;
  let listCalls = 0;
  const uploadStarted = new Promise((resolve) => { signalUploadStarted = resolve; });

  expenseApi.addExpense = async () => ({ data: { id: 2, name: 'Added with receipt', receipts: [] } });
  expenseApi.uploadExpenseReceipts = async () => {
    signalUploadStarted();
    return new Promise((resolve) => {
      finishUpload = () => resolve({ data: [{ id: 91, expenseId: 2 }] });
    });
  };
  expenseApi.getExpenses = async () => {
    listCalls += 1;
    return { data: [{ id: 2, receipts: [{ id: 91 }] }] };
  };

  const composite = expenseActions.runCompositeExpenseMutation(store.dispatch, async (commitCoreMutation) => {
    const added = await commitCoreMutation(
      expenseActions.addExpenseAction({ name: 'Added with receipt' }, { invalidateLists: false })
    );
    await store.dispatch(expenseActions.uploadExpenseReceiptsAction(added.id, [{}]));
  });

  await uploadStarted;
  assert.equal(selectRequest(store.expenseState, mounted.dashboardKey)?.stale, false, 'core add is deferred while receipt upload is pending');
  assert.equal(store.dispatchedActions.filter(({ type }) => type === TYPES.INVALIDATE_EXPENSE_LISTS).length, 0);

  finishUpload();
  await composite;
  assert.equal(selectRequest(store.expenseState, mounted.dashboardKey)?.stale, true);
  assert.equal(selectRequest(store.expenseState, mounted.paymentsCardKey)?.stale, true);
  assert.equal(store.dispatchedActions.filter(({ type }) => type === TYPES.INVALIDATE_EXPENSE_LISTS).length, 1);

  const explicitRefresh = store.dispatch(
    expenseActions.getRegisteredExpensesAction(44, { propertyId: 12 }, mounted.dashboardKey)
  );
  const observerRefresh = store.dispatch(
    expenseActions.getStaleExpensesAction(44, { propertyId: 12 }, mounted.dashboardKey)
  );
  assert.equal(observerRefresh, null, 'the synchronous explicit refresh claims stale before the hook observer');
  await explicitRefresh;
  assert.equal(listCalls, 1);
  assert.equal(
    store.dispatchedActions.filter(({ type, meta }) => type === TYPES.GET_EXPENSES_START && meta?.requestKey === mounted.dashboardKey).length,
    1
  );
});

test('a receipt failure after a deferred update invalidates once, while a failed core mutation does not invalidate', async () => {
  const mounted = createMountedScopeState();
  const partialStore = createStore(mounted.state);
  expenseApi.updateExpense = async (_expenseId, expense) => ({ data: expense });
  expenseApi.deleteExpenseReceipt = async () => { throw new Error('receipt delete failed'); };

  await assert.rejects(
    expenseActions.runCompositeExpenseMutation(partialStore.dispatch, async (commitCoreMutation) => {
      await commitCoreMutation(
        expenseActions.updateExpenseAction(1, { id: 1, name: 'Updated' }, { invalidateLists: false })
      );
      await partialStore.dispatch(expenseActions.deleteExpenseReceiptAction(91));
    }),
    /receipt delete failed/
  );
  assert.equal(selectRequest(partialStore.expenseState, mounted.dashboardKey)?.stale, true);
  assert.equal(partialStore.dispatchedActions.filter(({ type }) => type === TYPES.INVALIDATE_EXPENSE_LISTS).length, 1);

  const failedStore = createStore(createMountedScopeState().state);
  expenseApi.addExpense = async () => { throw new Error('core add failed'); };
  await assert.rejects(
    expenseActions.runCompositeExpenseMutation(failedStore.dispatch, async (commitCoreMutation) => {
      await commitCoreMutation(
        expenseActions.addExpenseAction({ name: 'Never added' }, { invalidateLists: false })
      );
    }),
    /core add failed/
  );
  assert.equal(selectRequest(failedStore.expenseState, mounted.dashboardKey)?.stale, false);
  assert.equal(failedStore.dispatchedActions.filter(({ type }) => type === TYPES.INVALIDATE_EXPENSE_LISTS).length, 0);
});

test('standalone add, update, and delete actions retain automatic list invalidation', async () => {
  expenseApi.addExpense = async (expense) => ({ data: { id: 2, ...expense } });
  expenseApi.updateExpense = async (_expenseId, expense) => ({ data: expense });
  expenseApi.deleteExpense = async () => undefined;

  const mutations = [
    (store) => store.dispatch(expenseActions.addExpenseAction({ name: 'Standalone add' })),
    (store) => store.dispatch(expenseActions.updateExpenseAction(1, { id: 1, name: 'Standalone update' })),
    (store) => store.dispatch(expenseActions.deleteExpenseAction(1))
  ];

  for (const mutate of mutations) {
    const mounted = createMountedScopeState();
    const store = createStore(mounted.state);
    await mutate(store);
    assert.equal(selectRequest(store.expenseState, mounted.dashboardKey)?.stale, true);
    assert.equal(selectRequest(store.expenseState, mounted.paymentsCardKey)?.stale, true);
  }
});

test('a captured explicit refetch cannot recreate a scope after its final release', async () => {
  const mounted = createMountedScopeState();
  const store = createStore(mounted.state);
  let listCalls = 0;
  expenseApi.getExpenses = async () => {
    listCalls += 1;
    return { data: [] };
  };

  store.dispatch(scopeAction(TYPES.RELEASE_EXPENSE_LIST_SCOPE, mounted.dashboardKey));
  const result = store.dispatch(
    expenseActions.getRegisteredExpensesAction(44, { propertyId: 12 }, mounted.dashboardKey)
  );

  assert.equal(result, null);
  assert.equal(listCalls, 0);
  assert.equal(selectRequest(store.expenseState, mounted.dashboardKey), null);
  assert.equal(store.expenseState.listRequestRefCounts[mounted.dashboardKey], undefined);
});

test('create success with receipt failure stays committed and receipt retry never invokes add again', async () => {
  const mounted = createMountedScopeState();
  const store = createStore(mounted.state);
  let addCalls = 0;
  let uploadCalls = 0;

  expenseApi.addExpense = async () => {
    addCalls += 1;
    return { data: { id: 73, name: 'Created once' } };
  };
  expenseApi.uploadExpenseReceipts = async () => {
    uploadCalls += 1;
    throw new Error('receipt upload failed');
  };

  const result = await expenseActions.runCompositeExpenseMutation(store.dispatch, async (commitCoreMutation) => {
    return expenseActions.createExpenseWithReceipts({
      commitCoreMutation,
      dispatch: store.dispatch,
      createAction: expenseActions.addExpenseAction({ name: 'Created once' }, { invalidateLists: false }),
      receiptFiles: [{}]
    });
  });

  assert.equal(result.status, 'created-without-receipts');
  assert.equal(result.expenseId, 73);
  assert.equal(addCalls, 1);
  assert.equal(uploadCalls, 1);
  assert.equal(store.dispatchedActions.filter(({ type }) => type === TYPES.INVALIDATE_EXPENSE_LISTS).length, 1);

  await assert.rejects(result.retryReceipt(), /receipt upload failed/);
  assert.equal(addCalls, 1);
  assert.equal(uploadCalls, 2);
});
