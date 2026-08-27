import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { RECURRING_EXPENSE_ACTION_TYPES as recurringTypes } from './recurring-expense/recurring-expense.types.js';
import { FUTURE_EXPENSE_ACTION_TYPES as futureTypes } from './future-expense/future-expense.types.js';

const loadReducer = async (relativePath, importPattern, types) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const executable = source.replace(importPattern, `const ${types.name} = ${JSON.stringify(types.value)};`);
  return (await import(`data:text/javascript,${encodeURIComponent(executable)}`)).default;
};

const recurringReducer = await loadReducer(
  './recurring-expense/recurring-expense.reducer.js',
  /import \{ RECURRING_EXPENSE_ACTION_TYPES \} from '.\/recurring-expense\.types';/,
  { name: 'RECURRING_EXPENSE_ACTION_TYPES', value: recurringTypes }
);

const futureReducer = await loadReducer(
  './future-expense/future-expense.reducer.js',
  /import \{ FUTURE_EXPENSE_ACTION_TYPES \} from '.\/future-expense\.types';/,
  { name: 'FUTURE_EXPENSE_ACTION_TYPES', value: futureTypes }
);

const requestCases = [
  {
    label: 'recurring',
    reducer: recurringReducer,
    types: recurringTypes,
    listField: 'recurringExpenses',
    start: 'GET_RECURRING_EXPENSES_START',
    success: 'GET_RECURRING_EXPENSES_SUCCESS',
    failure: 'GET_RECURRING_EXPENSES_FAILURE',
    mutationStart: 'PAUSE_RECURRING_EXPENSE_START',
    mutationSuccess: 'PAUSE_RECURRING_EXPENSE_SUCCESS',
    mutationPayload: { id: 22, name: 'Current', isPaused: true }
  },
  {
    label: 'future',
    reducer: futureReducer,
    types: futureTypes,
    listField: 'futureExpenses',
    start: 'GET_FUTURE_EXPENSES_START',
    success: 'GET_FUTURE_EXPENSES_SUCCESS',
    failure: 'GET_FUTURE_EXPENSES_FAILURE',
    mutationStart: 'DELETE_FUTURE_EXPENSE_START',
    mutationSuccess: 'DELETE_FUTURE_EXPENSE_SUCCESS',
    mutationPayload: 22
  }
];

for (const config of requestCases) {
  test(`${config.label} list ignores out-of-order success and failure`, () => {
    let state = config.reducer(undefined, { type: '@@init' });
    state = config.reducer(state, {
      type: config.types[config.start],
      meta: { requestId: 1, requestKey: 'property:12' }
    });
    state = config.reducer(state, {
      type: config.types[config.start],
      meta: { requestId: 2, requestKey: 'property:13' }
    });
    state = config.reducer(state, {
      type: config.types[config.success],
      payload: [{ id: 22, name: 'Current' }],
      meta: { requestId: 2, requestKey: 'property:13' }
    });
    state = config.reducer(state, {
      type: config.types[config.failure],
      payload: 'old request failed',
      meta: { requestId: 1, requestKey: 'property:12' }
    });
    state = config.reducer(state, {
      type: config.types[config.success],
      payload: [{ id: 12, name: 'Stale' }],
      meta: { requestId: 1, requestKey: 'property:12' }
    });

    assert.deepEqual(state[config.listField], [{ id: 22, name: 'Current' }]);
    assert.equal(state.listError, null);
    assert.equal(state.listLoading, false);
    assert.equal(state.listSettledRequestKey, 'property:13');

    state = config.reducer(state, {
      type: config.types[config.start],
      meta: { requestId: 3, requestKey: 'property:14' }
    });
    state = config.reducer(state, {
      type: config.types[config.failure],
      payload: 'current request failed',
      meta: { requestId: 3, requestKey: 'property:14' }
    });
    state = config.reducer(state, {
      type: config.types[config.success],
      payload: [{ id: 99, name: 'Late stale data' }],
      meta: { requestId: 2, requestKey: 'property:13' }
    });

    assert.deepEqual(state[config.listField], []);
    assert.equal(state.listError, 'current request failed');
    assert.equal(state.listSettledRequestKey, 'property:14');
  });

  test(`${config.label} mutation state is separate and invalidates pre-mutation list completion`, () => {
    let state = config.reducer(undefined, { type: '@@init' });
    state = config.reducer(state, {
      type: config.types[config.start],
      meta: { requestId: 1, requestKey: 'scope:before' }
    });
    state = config.reducer(state, {
      type: config.types[config.success],
      payload: [{ id: 22, name: 'Current' }],
      meta: { requestId: 1, requestKey: 'scope:before' }
    });
    state = config.reducer(state, {
      type: config.types[config.start],
      meta: { requestId: 2, requestKey: 'scope:refresh' }
    });
    state = config.reducer(state, { type: config.types[config.mutationStart] });

    assert.equal(state.listLoading, true);
    assert.equal(state.mutationLoading, true);

    state = config.reducer(state, {
      type: config.types[config.mutationSuccess],
      payload: config.mutationPayload
    });
    state = config.reducer(state, {
      type: config.types[config.success],
      payload: [{ id: 22, name: 'Pre-mutation response' }],
      meta: { requestId: 2, requestKey: 'scope:refresh' }
    });

    assert.equal(state.mutationLoading, false);
    if (config.label === 'recurring') {
      assert.equal(state[config.listField][0].isPaused, true);
    } else {
      assert.deepEqual(state[config.listField], []);
    }
  });
}

test('future cleanup marker survives failures and is reconciled by deletion or a settled absent list', () => {
  const markType = futureTypes.MARK_FUTURE_EXPENSE_CLEANUP_PENDING;
  let state = futureReducer(undefined, { type: '@@init' });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 1, requestKey: 'scope' }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [{ id: 9, name: 'Roof inspection' }],
    meta: { requestId: 1, requestKey: 'scope' }
  });
  state = futureReducer(state, {
    type: markType,
    payload: {
      futureExpenseId: 9,
      marker: { expenseId: 101, cleanupError: 'Scheduled item could not be removed' }
    }
  });
  state = futureReducer(state, {
    type: futureTypes.DELETE_FUTURE_EXPENSE_FAILURE,
    payload: 'delete failed'
  });

  assert.deepEqual(state.recordedExpenseCleanupById['9'], {
    expenseId: 101,
    cleanupError: 'Scheduled item could not be removed'
  });
  assert.equal(state.futureExpenses.length, 1);

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 2, requestKey: 'scope:refresh' }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [{ Id: 9, Name: 'Roof inspection' }],
    meta: { requestId: 2, requestKey: 'scope:refresh' }
  });
  assert.ok(state.recordedExpenseCleanupById['9']);

  state = futureReducer(state, {
    type: futureTypes.DELETE_FUTURE_EXPENSE_SUCCESS,
    payload: 9
  });
  assert.equal(state.recordedExpenseCleanupById['9'], undefined);
  assert.deepEqual(state.futureExpenses, []);

  state = futureReducer(state, {
    type: markType,
    payload: { futureExpenseId: 10, marker: { expenseId: 102 } }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 3, requestKey: 'scope:reconcile' }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [],
    meta: { requestId: 3, requestKey: 'scope:reconcile' }
  });
  assert.deepEqual(state.recordedExpenseCleanupById, {});
});

test('property-scoped future success reconciles only markers in that property while portfolio success reconciles all', () => {
  const markType = futureTypes.MARK_FUTURE_EXPENSE_CLEANUP_PENDING;
  let state = futureReducer(undefined, { type: '@@init' });
  for (const marker of [
    { futureExpenseId: 9, propertyId: 12, landlordId: 44 },
    { futureExpenseId: 13, propertyId: 13, landlordId: 44 }
  ]) {
    state = futureReducer(state, {
      type: markType,
      payload: { futureExpenseId: marker.futureExpenseId, marker }
    });
  }

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 10, requestKey: 'property:13', landlordId: 44, propertyId: 13 }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [{ id: 13, propertyId: 13 }],
    meta: { requestId: 10, requestKey: 'property:13', landlordId: 44, propertyId: 13 }
  });

  assert.deepEqual(Object.keys(state.recordedExpenseCleanupById).sort(), ['13', '9']);

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 11, requestKey: 'property:13:empty', landlordId: 44, propertyId: 13 }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [],
    meta: { requestId: 11, requestKey: 'property:13:empty', landlordId: 44, propertyId: 13 }
  });

  assert.deepEqual(Object.keys(state.recordedExpenseCleanupById), ['9']);

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 12, requestKey: 'portfolio', landlordId: 44, propertyId: null }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [],
    meta: { requestId: 12, requestKey: 'portfolio', landlordId: 44, propertyId: null }
  });

  assert.deepEqual(state.recordedExpenseCleanupById, {});
});

test('future cleanup hydration restores one organization runtime map before list reconciliation', () => {
  const marker44 = { futureExpenseId: 9, propertyId: 12, landlordId: 44, organizationId: 7 };
  let state = futureReducer(undefined, { type: '@@init' });
  state = futureReducer(state, {
    type: futureTypes.HYDRATE_FUTURE_EXPENSE_CLEANUP,
    payload: { landlordId: 44, organizationId: 7, markers: { '9': marker44 } }
  });

  assert.deepEqual(state.cleanupHydratedIdentity, { landlordId: '44', organizationId: '7' });
  assert.deepEqual(state.recordedExpenseCleanupById, { '9': marker44 });

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: { requestId: 20, requestKey: 'restored', landlordId: 44, organizationId: 7, propertyId: 12 }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [{ id: 9, propertyId: 12, name: 'Server row after reload' }],
    meta: { requestId: 20, requestKey: 'restored', landlordId: 44, organizationId: 7, propertyId: 12 }
  });

  assert.deepEqual(state.recordedExpenseCleanupById, { '9': marker44 });

  state = futureReducer(state, {
    type: futureTypes.HYDRATE_FUTURE_EXPENSE_CLEANUP,
    payload: { landlordId: 44, organizationId: 8, markers: {} }
  });
  assert.deepEqual(state.cleanupHydratedIdentity, { landlordId: '44', organizationId: '8' });
  assert.deepEqual(state.recordedExpenseCleanupById, {});
});

test('future cleanup organization switch isolates colliding IDs and scoped authoritative cleanup', () => {
  const organization7 = { futureExpenseId: 9, propertyId: 12, landlordId: 44, organizationId: 7 };
  const organization8Collision = { futureExpenseId: 9, propertyId: 12, landlordId: 44, organizationId: 8 };
  const organization8Other = { futureExpenseId: 10, propertyId: 13, landlordId: 44, organizationId: 8 };
  let state = futureReducer(undefined, { type: '@@init' });

  state = futureReducer(state, {
    type: futureTypes.HYDRATE_FUTURE_EXPENSE_CLEANUP,
    payload: { landlordId: 44, organizationId: 7, markers: { 9: organization7 } }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: {
      requestId: 20,
      requestKey: 'organization:7:property:12',
      landlordId: 44,
      organizationId: 7,
      propertyId: 12
    }
  });
  state = futureReducer(state, {
    type: futureTypes.HYDRATE_FUTURE_EXPENSE_CLEANUP,
    payload: {
      landlordId: 44,
      organizationId: 8,
      markers: { 9: organization8Collision, 10: organization8Other } }
  });
  assert.deepEqual(state.recordedExpenseCleanupById, {
    9: organization8Collision,
    10: organization8Other
  });

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [],
    meta: {
      requestId: 20,
      requestKey: 'organization:7:property:12',
      landlordId: 44,
      organizationId: 7,
      propertyId: 12
    }
  });
  assert.deepEqual(state.recordedExpenseCleanupById, {
    9: organization8Collision,
    10: organization8Other
  });

  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_START,
    meta: {
      requestId: 21,
      requestKey: 'organization:8:property:12',
      landlordId: 44,
      organizationId: 8,
      propertyId: 12
    }
  });
  state = futureReducer(state, {
    type: futureTypes.GET_FUTURE_EXPENSES_SUCCESS,
    payload: [],
    meta: {
      requestId: 21,
      requestKey: 'organization:8:property:12',
      landlordId: 44,
      organizationId: 8,
      propertyId: 12
    }
  });
  assert.deepEqual(state.recordedExpenseCleanupById, { 10: organization8Other });
});

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const loadListAction = async ({ relativePath, apiName, apiGlobal, typesName, types }) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const apiImport = new RegExp(`import \\{[\\s\\S]*?\\} from 'api/${apiName}';`);
  const typesImport = new RegExp(`import \\{ ${typesName} \\} from './[^']+\\.types';`);
  const executable = source
    .replace(apiImport, `const { ${Object.keys(globalThis[apiGlobal]).join(', ')} } = globalThis.${apiGlobal};`)
    .replace(typesImport, `const ${typesName} = ${JSON.stringify(types)};`);
  return import(`data:text/javascript,${encodeURIComponent(executable)}#${apiName}`);
};

for (const config of [
  {
    label: 'recurring',
    reducer: recurringReducer,
    relativePath: './recurring-expense/recurring-expense.action.js',
    apiName: 'recurringExpense',
    apiGlobal: '__scheduledRecurringApi',
    getApiName: 'getRecurringExpenses',
    getActionName: 'getRecurringExpensesAction',
    typesName: 'RECURRING_EXPENSE_ACTION_TYPES',
    types: recurringTypes,
    startType: recurringTypes.GET_RECURRING_EXPENSES_START,
    listField: 'recurringExpenses',
    apiFunctions: [
      'getRecurringExpenses',
      'getRecurringExpenseById',
      'addRecurringExpense',
      'updateRecurringExpense',
      'deleteRecurringExpense',
      'pauseRecurringExpense',
      'resumeRecurringExpense'
    ]
  },
  {
    label: 'future',
    reducer: futureReducer,
    relativePath: './future-expense/future-expense.action.js',
    apiName: 'futureExpense',
    apiGlobal: '__scheduledFutureApi',
    getApiName: 'getFutureExpenses',
    getActionName: 'getFutureExpensesAction',
    typesName: 'FUTURE_EXPENSE_ACTION_TYPES',
    types: futureTypes,
    startType: futureTypes.GET_FUTURE_EXPENSES_START,
    listField: 'futureExpenses',
    apiFunctions: ['getFutureExpenses', 'getFutureExpenseById', 'addFutureExpense', 'deleteFutureExpense']
  }
]) {
  test(`${config.label} thunk identities protect the reducer when requests settle out of order`, async () => {
    const requests = new Map();
    const fakeApi = Object.fromEntries(config.apiFunctions.map((name) => [name, async () => undefined]));
    fakeApi[config.getApiName] = async (_landlordId, filters) => {
      const request = deferred();
      requests.set(filters.propertyId, request);
      return request.promise;
    };
    globalThis[config.apiGlobal] = fakeApi;

    const actions = [];
    let state = config.reducer(undefined, { type: '@@init' });
    const dispatch = (action) => {
      if (typeof action === 'function') return action(dispatch);
      actions.push(action);
      state = config.reducer(state, action);
      return action;
    };
    const actionModule = await loadListAction(config);
    const oldRequest = dispatch(actionModule[config.getActionName](44, { propertyId: 12 }, 'scope:old'));
    const currentRequest = dispatch(actionModule[config.getActionName](44, { propertyId: 13 }, 'scope:current'));
    const starts = actions.filter((action) => action.type === config.startType);

    assert.equal(starts.length, 2);
    assert.notEqual(starts[0].meta.requestId, starts[1].meta.requestId);
    assert.deepEqual(
      starts.map((action) => action.meta.requestKey),
      ['scope:old', 'scope:current']
    );

    requests.get(13).resolve([{ id: 13, name: 'Current' }]);
    await currentRequest;
    requests.get(12).reject(new Error('late old failure'));
    await oldRequest;

    assert.deepEqual(state[config.listField], [{ id: 13, name: 'Current' }]);
    assert.equal(state.listError, null);
    assert.equal(state.listSettledRequestKey, 'scope:current');
    delete globalThis[config.apiGlobal];
  });
}
