import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSync, transformFromAstSync } from '@babel/core';
import { loadPaymentTimings } from './paymentTiming.mjs';

// Exercise the actual saved handlers/effects without needing a browser or API.
function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}
function extract(path, predicate) {
  const ast = parseSync(source(path), { babelrc: false, configFile: false, parserOpts: { plugins: ['jsx'] } });
  let found;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) found = node;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.ok(found, `Expected production node in ${path}`);
  return found;
}
function code(node) {
  return transformFromAstSync({ type: 'File', program: { type: 'Program', sourceType: 'script', body: [
    { type: 'ExpressionStatement', expression: node }
  ] } }, '', { babelrc: false, configFile: false }).code.replace(/;\s*$/, '');
}
const drawerPath = '../../../components/drawers/RecordPaymentDrawer.jsx';
const submit = extract(drawerPath, n => n.type === 'VariableDeclarator' && n.id.name === 'handleSubmit').init;
const paymentEffect = extract('./PaymentsTab.jsx', n => n.type === 'CallExpression' && n.callee.name === 'useEffect');
const balanceEffect = extract('../../../pages/landlord/property.jsx', n => n.type === 'CallExpression' &&
  n.callee.name === 'useEffect' && n.arguments[1]?.elements?.some(e => e?.name === 'refetchRentCollection'));

function saveHandler(response, reject = false) {
  let notifications = 0;
  const errors = [];
  const handler = new Function('selectedLease', 'selectedTenant', 'paymentData', 'user', 'axiosServices',
    'formatLocalDateTime', 'setLoading', 'setError', 'setLatestRentRecord', 'setIsComplete', 'openSnackbar', 'onSuccess',
    `return ${code(submit)}`)(
    { id: 11 }, { id: 23 }, { amount: 690, paymentDate: new Date() }, { id: 1 },
    { post: async () => { if (reject) throw new Error('Network failure'); return response; } },
    () => '2026-11-07T10:00:00', () => {}, value => errors.push(value), () => {}, () => {}, () => {},
    () => { notifications++; }
  );
  return { handler, errors, get notifications() { return notifications; } };
}

test('successful payment save emits refresh immediately, not only when drawer closes', async () => {
  const h = saveHandler({ data: { success: true, data: { rentDue: 0 } } });
  await h.handler();
  assert.deepEqual(h.errors, [null]);
  assert.equal(h.notifications, 1);
  await h.handler();
  assert.equal(h.notifications, 2, 'Record Another must also refresh');
  assert.match(source('../../../layout/Dashboard/index.jsx'), /<RecordPaymentDrawer onSuccess=\{drawer\.notifyFinanceMutation\}/);
});

test('failed payment saves do not emit a success refresh', async () => {
  for (const reject of [false, true]) {
    const h = saveHandler({ data: { success: false, message: 'Rejected' } }, reject);
    await h.handler();
    assert.equal(h.notifications, 0);
    assert.deepEqual(h.errors, [null, reject ? 'Network failure' : 'Rejected']);
  }
});

test('each finance mutation refetches the property header balance once without waiting for drawer close', () => {
  const deps = balanceEffect.arguments[1].elements.map(code).join(' ');
  assert.match(deps, /drawer\.financeMutationVersion/);
  assert.match(deps, /refetchRentCollection/);
  let calls = 0;
  const lastFinanceMutationVersion = { current: 3 };
  for (const [version, expectedCalls] of [[3, 0], [4, 1], [4, 1], [5, 2]]) {
    new Function('drawer', 'refetchRentCollection', 'lastFinanceMutationVersion', `return (${code(balanceEffect.arguments[0])})();`)(
      { financeMutationVersion: version, isOpenPaymentAdd: true }, () => { calls++; }, lastFinanceMutationVersion);
    assert.equal(calls, expectedCalls);
  }
  const page = source('../../../pages/landlord/property.jsx');
  assert.match(page, /refetch:\s*refetchRentCollection\s*}\s*=\s*usePropertyRentCollection\(propertyId\)/);
  assert.match(page, /<PropertyHeader[\s\S]*?rentRecords=\{rentRecords\}/);
  assert.doesNotMatch(page, /<PropertyRecordsTabs[^>]*rentRecords=\{rentRecords\}/);
});

test('property balance requests and refreshes are scoped to the active organization and route property', async () => {
  const path = '../../../hooks/usePropertyRentCollection.js';
  const fetchNode = extract(path, n => n.type === 'VariableDeclarator' && n.id.name === 'fetchPropertyRentCollection').init;
  const requests = [];
  const records = [{ propertyId: 7, leaseId: 11, currentBillingPeriodRentDue: 0 }];
  const fetchBalance = new Function('axiosServices', `return ${code(fetchNode)}`)({
    get: async (...args) => { requests.push(args); return { data: { data: { rentRecords: records } } }; }
  });
  const hookNode = extract(path, n => n.type === 'FunctionDeclaration' && n.id.name === 'usePropertyRentCollection');
  const keys = [];
  const mutate = () => {};
  let organizationId = 19;
  const usePropertyRentCollection = new Function('useSelector', 'getActiveOrganizationId', 'useSWR', 'fetchPropertyRentCollection',
    `return ${code({ ...hookNode, type: 'FunctionExpression' })}`)(
    select => select({ auth: { user: { organizationId } } }), user => user.organizationId,
    (key, fetcher) => { keys.push(key); assert.equal(fetcher, fetchBalance); return { data: { rentRecords: records }, mutate }; }, fetchBalance
  );

  const balance = usePropertyRentCollection(7);
  assert.equal(balance.refetch, mutate);
  assert.equal(balance.rentRecords, records);
  assert.deepEqual(await fetchBalance(keys[0]), { rentRecords: records });
  assert.deepEqual(requests, [['/api/rent-collection', { headers: { 'X-Organization-Id': '19' }, params: { propertyId: '7', lifetime: false } }]]);
  usePropertyRentCollection(8);
  organizationId = 20;
  usePropertyRentCollection(7);
  usePropertyRentCollection(null);
  assert.deepEqual(keys, [
    ['/api/rent-collection', 19, '7'], ['/api/rent-collection', 19, '8'], ['/api/rent-collection', 20, '7'], null
  ]);
});

test('payment list refetches after mutation and ignores aborted old-property responses', async () => {
  assert.match(paymentEffect.arguments[1].elements.map(code).join(' '), /drawer\.financeMutationVersion/);
  const requests = [], results = [];
  const axios = { get: (url, options) => new Promise(resolve => requests.push({ url, ...options, resolve })) };
  const run = id => new Function('propertyId', 'setResult', 'axiosServices', 'loadPaymentTimings', 'property', `return (${code(paymentEffect.arguments[0])})();`)(
    id, result => results.push(result), axios, loadPaymentTimings, { units: [] });
  const cleanup = run(7);
  cleanup();
  run(8);
  requests[0].resolve({ data: { data: [{ id: 'old-property-payment' }] } });
  requests[1].resolve({ data: { data: [{ id: 'recorded-payment' }] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].url, '/api/payment/all?propertyId=8');
  assert.deepEqual(results.at(-1), { propertyId: 8, payments: [{ id: 'recorded-payment', paymentTiming: null }], timingError: false, loading: false, error: '' });
  assert.ok(!results.some(r => r.payments.some(p => p.id === 'old-property-payment')));
});

test('aborting during charge loading cannot publish stale payment timing', async () => {
  const requests = [], results = [];
  const axios = { get: (url, options) => new Promise(resolve => requests.push({ url, ...options, resolve })) };
  const cleanup = new Function('propertyId', 'setResult', 'axiosServices', 'loadPaymentTimings', 'property', `return (${code(paymentEffect.arguments[0])})();`)(
    7, result => results.push(result), axios, loadPaymentTimings, { units: [] });
  requests[0].resolve({ data: [{ id: 12, leaseId: 7, amount: 100, status: 'Completed', paymentDate: '2026-03-02' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[1].url, '/api/payment/7/charges');
  cleanup();
  assert.equal(requests[1].signal.aborted, true);
  requests[1].resolve({ data: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(results, [{ propertyId: 7, payments: [], loading: true, error: '' }]);
});
