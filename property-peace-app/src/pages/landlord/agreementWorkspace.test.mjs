import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { agreementWorkspaceStatus, loadWorkspaceAgreements, startWorkspaceAgreementLoad } from './agreementWorkspace.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const generate = require('@babel/generator').default;
const ast = parse(fs.readFileSync(new URL('./leases.jsx', import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
function productionExpression(name) {
  let result;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id.name === name) result = node.init;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(ast);
  assert.ok(result, name);
  return generate(result).code;
}
const missing = () => { throw { response: { status: 404 } }; };
const properties = [{ id: 1, name: 'Oak', propertyType: 'SingleFamily', units: [{ id: 8, name: 'A', lease: { id: 10 } }] }];
const envelope = (data) => ({ data: { success: true, data } });
const progress = { isDraft: true, canResume: true, isFinalized: false, isPeopleOnLeaseComplete: true };
function fixture({ states = {}, documents = {}, failure } = {}) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (failure && url.includes(failure)) throw new Error('Network unavailable');
    if (url.endsWith('/all')) return envelope([10, 20, 30].map((id) => ({ id, unitId: 8, isDrafted: false })));
    const id = Number(url.match(/\d+/)[0]);
    if (url.includes('/by-id/')) return envelope({ id, propertyId: 1, unitId: 8, tenants: [{ firstName: 'Tenant' }], startDate: '2027-01-01', isDrafted: false });
    return states[id] === null ? missing() : envelope(states[id] || { isDraft: true, canResume: true });
  };
  const doc = async (id) => documents[id] ? { success: true, data: documents[id] } : missing();
  return { get, doc, calls };
}
test('first supplemental save exposes documentless scheduled/historical lease, not untouched setup', async () => {
  const api = fixture({ states: { 20: progress, 30: { ...progress, isPeopleOnLeaseComplete: false, isUtilitiesMaintenanceKeysComplete: true } } });
  const rows = await loadWorkspaceAgreements(properties, api.get, api.doc);
  assert.deepEqual(rows.map((row) => row.id), [20, 30]);
  assert.equal(rows[0].propertyId, 1);
  assert.equal(rows[0].unitName, 'A');
  assert.equal(rows[0].hasAgreement, false);
  assert.equal(agreementWorkspaceStatus(rows[0]), 'draft');
  assert.ok(api.calls.includes('/api/lease/property/1/all'));
  assert.ok(api.calls.includes('/api/Lease/by-id/20'));
});
test('finalized and signed documents remain documents despite legacy draft and step flags', async () => {
  const api = fixture({ states: { 10: { ...progress, isFinalized: true }, 20: { ...progress, isDraft: false, canResume: false }, 30: null }, documents: { 10: { blobUrl: 'final' }, 20: { blobUrl: 'signed' }, 30: { blobUrl: 'legacy' } } });
  const rows = await loadWorkspaceAgreements(properties, api.get, api.doc);
  assert.ok(rows.every((row) => row.hasAgreement && !row.isAgreementDraft));
  assert.equal(agreementWorkspaceStatus({ ...rows[1], isDrafted: true, landlordSignedAt: 'signed', tenants: [{ tenantSignedAt: 'signed' }] }), 'complete');
});
test('draft preview never becomes a PDF action or awaiting-signature metric', async () => {
  const api = fixture({ states: { 20: progress }, documents: { 20: { blobUrl: 'preview' } } });
  const rows = await loadWorkspaceAgreements(properties, api.get, api.doc);
  const metrics = vm.runInNewContext(productionExpression('leaseAgreementsMetrics'), { useMemo: (fn) => fn(), filteredLeaseAgreements: rows });
  assert.equal(metrics.awaitingSignature, 0);
  assert.equal(metrics.signedComplete, 0);
  let fetched = false;
  const view = vm.runInNewContext(productionExpression('handleViewAgreement'), { openSnackbar: () => {}, tenantDocumentAPI: { getLeaseAgreement: () => { fetched = true; } } });
  await view(rows[0]);
  assert.equal(fetched, false);
  let destination;
  const resume = vm.runInNewContext(productionExpression('handleViewLeaseFromAgreement'), { URLSearchParams, navigate: (url) => { destination = url; } });
  resume(rows[0]);
  assert.equal(destination, '/landlord/leases/build-lease-agreement?leaseId=20&propertyId=1&unitId=8');
});
test('portfolio/progress/document failures reject instead of silently dropping agreements', async () => {
  for (const failure of ['/all', '/agreement', '/by-id/']) {
    const api = fixture({ failure });
    await assert.rejects(loadWorkspaceAgreements(properties, api.get, api.doc), /Network unavailable/);
  }
  const api = fixture();
  await assert.rejects(loadWorkspaceAgreements(properties, api.get, async () => { throw new Error('Document failure'); }), /Document failure/);
});
// Execute the real response-interceptor normalizer so these tests use the runtime
// rejection contract, rather than only the raw Axios shape used by older fixtures.
const axiosAst = parse(fs.readFileSync(new URL('../../utils/axios.js', import.meta.url), 'utf8'), { sourceType: 'module' });
const normalizer = axiosAst.program.body.find((node) => node.type === 'ExportNamedDeclaration' &&
  node.declaration?.declarations?.[0]?.id.name === 'normalizeAxiosError').declaration.declarations[0].init;
const normalizeError = vm.runInNewContext(generate(normalizer).code);
const normalizedFailure = (status) => normalizeError({ response: { status, data: { message: 'Request failed' } } });

test('normalized progress 404 does not hide other saved drafts or legacy documents', async () => {
  const api = fixture({ states: { 20: progress }, documents: { 30: { blobUrl: 'legacy' } } });
  const rows = await loadWorkspaceAgreements(properties, async (url) => {
    if (url === '/api/Lease/10/agreement' || url === '/api/Lease/30/agreement') throw normalizedFailure(404);
    return api.get(url);
  }, api.doc);
  assert.deepEqual(rows.map((row) => row.id), [20, 30]);
  assert.equal(rows[0].isAgreementDraft, true);
  assert.equal(rows[1].hasAgreement, true);
});

test('normalized document 400/404 and successful null documents preserve documentless drafts', async () => {
  for (const status of [400, 404, null]) {
    const api = fixture({ states: { 20: progress } });
    const rows = await loadWorkspaceAgreements(properties, api.get, async () => {
      if (status !== null) throw normalizedFailure(status);
      return { success: true, data: null };
    });
    assert.deepEqual(rows.map((row) => row.id), [20]);
    assert.equal(rows[0].hasAgreement, false);
    assert.equal(rows[0].isAgreementDraft, true);
  }
});

test('normalized auth/server/network failures still reject with actionable errors', async () => {
  for (const status of [401, 403, 500, undefined]) {
    const api = fixture();
    const failure = normalizedFailure(status);
    await assert.rejects(loadWorkspaceAgreements(properties, async (url) => {
      if (url.endsWith('/agreement')) throw failure;
      return api.get(url);
    }, api.doc), (error) => error === failure);
    await assert.rejects(loadWorkspaceAgreements(properties, api.get, async () => { throw failure; }),
      (error) => error === failure);
  }
});

test('cancellation suppresses old organization success, error, and loading completion; retry publishes', async () => {
  for (const fails of [false, true]) {
    let settle;
    const events = [];
    const callbacks = { onSuccess: () => events.push('success'), onError: () => events.push('error'), onFinally: () => events.push('finally') };
    const request = startWorkspaceAgreementLoad(() => new Promise((resolve, reject) => { settle = fails ? reject : resolve; }), callbacks);
    await Promise.resolve();
    request.cancel();
    settle(fails ? new Error('old org') : []);
    await request.done;
    assert.deepEqual(events, []);
    await startWorkspaceAgreementLoad(async () => [], callbacks).done;
    assert.deepEqual(events, ['success', 'finally']);
  }
});
test('workspace effect gates organization identity and failure UI exposes Retry', () => {
  const source = fs.readFileSync(new URL('./leases.jsx', import.meta.url), 'utf8');
  assert.match(source, /loadedPropertiesOrganizationId !== organizationId/);
  assert.match(source, /agreementsOrganizationId === organizationId \? leaseAgreements : \[\]/);
  assert.match(source, /return request\.cancel/);
  assert.match(source, /role="alert"/);
  assert.match(source, /setAgreementsRetry\(\(value\) => value \+ 1\)/);
  assert.match(source, /!la\.isAgreementDraft && la\.hasAgreement && <MenuItem/);
});
