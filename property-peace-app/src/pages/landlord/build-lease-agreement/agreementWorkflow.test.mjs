import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { agreementSections, agreementLeaseFacts, agreementLocked, loadAgreementContext, readAgreement } from './agreementWorkflow.mjs';
import { computeLeasePreflightChecks, areAllLeasePreflightChecksComplete } from '../../../utils/leasePreflight.js';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const directory = new URL('./', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, directory), 'utf8');
const walk = (node, callback) => {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => walk(item, callback));
    else if (value && typeof value === 'object') walk(value, callback);
  }
};
function arrow(source, name) {
  let result;
  walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }), (node) => {
    if (node.type === 'VariableDeclarator' && node.id.name === name) result = source.slice(node.init.start, node.init.end);
  });
  assert.ok(result, `production function ${name} exists`);
  return result;
}
const lease = { id: 7, propertyId: 10, unitId: 20, leaseLength: 12, propertyName: 'Saved property',
  startDate: '2026-08-01T00:00:00', endDate: '2027-07-31T00:00:00', rentDueDay: 1, rentAmount: 1500,
  depositAmount: 0, tenants: [{ firstName: 'Pat', lastName: 'Tenant' }], landlordName: 'Owner', petsAllowed: false,
  smokingAllowed: 'no', builtBefore1978: false, utilityServiceResponsibilities: [{ name: 'Water' }],
  maintenanceResponsibilities: [{ name: 'HVAC' }] };
const ok = (data) => ({ data: { success: true, data } });

test('agreement has only supplemental sections, not duplicate lease editing', () => {
  assert.deepEqual(agreementSections.map((section) => section.id), ['pets-smoking-other', 'utilities-maintenance-keys', 'provisions-attachments']);
  const main = read('../build-lease-agreement.jsx');
  assert.doesNotMatch(main, /<LeaseSpecificsPage|<RentDepositFeesPage|<PeopleOnLeasePage|updateLease\(/);
  assert.match(main, /From your lease/);
  assert.match(main, /leases\/\$\{leaseId\}\/builder/);
  assert.match(main, /display: active === index \? 'block' : 'none'/);
  assert.match(main, /hasUnsavedChanges/);
  parse(main, { sourceType: 'module', plugins: ['jsx'] });
});
test('canonical lease endpoint loads requested lease rather than property active-lease projection', async () => {
  const calls = [];
  const data = await loadAgreementContext(7, async (url) => { calls.push(url); return ok(url.endsWith('/instances') ? [] : lease); });
  assert.equal(data.lease.id, 7);
  assert.deepEqual(calls, ['/api/Lease/7', '/api/LeaseGeneration/lease/7/instances']);
  await assert.rejects(loadAgreementContext(7, async () => ok({ ...lease, id: 8 })), /could not be found/);
});
test('missing/invalid saved ID does not issue requests', async () => {
  for (const id of [0, -1, NaN, 1.5]) await assert.rejects(loadAgreementContext(id, () => { throw new Error('must not call'); }), /Choose a saved lease/);
});
test('status lookup errors fail closed rather than enabling finalized-agreement edits', async () => {
  await assert.rejects(loadAgreementContext(7, async (url) => url.endsWith('/instances') ? { data: { success: false } } : ok(lease)), /agreement status/);
});
test('legacy isDrafted false alone does not lock a standalone lease agreement', () => {
  assert.equal(agreementLocked({ ...lease, leaseAgreement: { isDrafted: false } }), false);
  assert.equal(agreementLocked(lease, [{ isFinalized: true }]), true);
  assert.equal(agreementLocked({ ...lease, leaseAgreement: { docuSignEnvelopeId: 'envelope' } }), true);
  assert.equal(agreementLocked({ ...lease, LeaseAgreement: { SignatureCompletedAt: '2026-08-01' } }), true);
});
test('read-only facts preserve zero deposits, saved rent frequency and people', () => {
  const facts = Object.fromEntries(agreementLeaseFacts({ ...lease, rentFrequency: 'Quarterly' }));
  assert.equal(facts['Security deposit'], '$0.00');
  assert.equal(facts['Rent (Quarterly)'], '$1,500.00');
  assert.equal(facts.Tenants, 'Pat Tenant');
  assert.equal(facts['Start date'], '08/01/2026');
  assert.equal(Object.fromEntries(agreementLeaseFacts({ ...lease, leaseLength: -1, endDate: null }))['End date'], 'No fixed end date');
});
test('preflight accepts canonical API datetime values and real month-to-month terms only', () => {
  assert.equal(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks(lease)), true);
  assert.equal(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks({ ...lease, leaseLength: -1, endDate: null })), true);
  assert.equal(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks({ ...lease, endDate: null })), false);
  assert.equal(areAllLeasePreflightChecksComplete(computeLeasePreflightChecks({ ...lease, startDate: '2026-02-30T00:00:00' })), false);
});

const fixtures = {
  'pets-smoking-other': { petsAllowed: false, pets: [], smokingAllowed: 'no', includeParkingRules: false, parkingTypes: [], parkingCustomRules: '' },
  'utilities-maintenance-keys': { hasSharedUtilities: false, sharedUtilitiesDisclosure: '', maintenanceNotificationMethods: [], utilities: [{ name: 'Water' }], maintenanceItems: [{ name: 'HVAC' }], leaseKeys: [] },
  'provisions-attachments': { includeEarlyTerminationClause: false, earlyTerminationClauseText: '', additionalTerms: '', builtBefore1978: false, awareOfLeadPaint: false, leadPaintExplanation: '', hasLeadPaintRecords: false, leadPaintRecordsExplanation: '' }
};
for (const [section, fixture] of Object.entries(fixtures)) {
  const source = read(`${section}.jsx`);
  test(`${section}: payload contains only allowed agreement fields and its completion flag`, () => {
    const keys = Object.keys(fixture);
    const payload = Function(...keys, `return (${arrow(source, 'buildUpdatePayload')})();`)(...Object.values(fixture));
    assert.equal(payload[agreementSections.find((item) => item.id === section).flag], true);
    for (const key of ['id', 'leaseId', 'propertyId', 'unitId', 'startDate', 'endDate', 'rentAmount', 'depositAmount', 'tenants', 'leaseLandlords']) assert.equal(Object.hasOwn(payload, key), false, key);
    assert.doesNotMatch(source, /\bupdateLease\(|\bpropertiesRefetch\(/);
    parse(source, { sourceType: 'module', plugins: ['jsx'] });
  });
  for (const success of [false, true]) test(`${section}: real save handler ${success ? 'advances only after save success' : 'preserves form after API failure'}`, async () => {
    const messages = [], calls = [];
    const bindings = { ...fixture, saving: false, loading: false, lease, leaseId: 7, embedded: true,
      validateLeadPaint: () => true, buildUpdatePayload: () => ({ supplemental: true }),
      setSaving: (value) => calls.push(['saving', value]),
      updateLeaseAgreement: (id, payload) => { calls.push(['patch', id, payload]); return { success, message: 'failed test save' }; },
      dispatch: async (result) => result, openSnackbar: (value) => messages.push(value), onSaved: async () => calls.push(['saved']), handleBack: () => calls.push(['back']) };
    await Function(...Object.keys(bindings), `return (${arrow(source, 'save')})();`)(...Object.values(bindings));
    assert.equal(calls.some(([name]) => name === 'saved'), success);
    assert.equal(messages.some((message) => message.alert.color === 'success'), success);
    assert.equal(messages.some((message) => message.alert.color === 'error'), !success);
    assert.deepEqual(calls.at(-1), ['saving', false]);
  });
}

test('creator and agreement destinations resolve to distinct real routes', () => {
  const routes = read('../../../routes/MainRoutes.jsx');
  for (const path of ['landlord/leases/builder', 'landlord/lease-builder']) {
    const start = routes.indexOf(`path: '${path}'`);
    assert.ok(start >= 0);
    assert.match(routes.slice(start, start + 220), /<LeaseBuilderPage \/>/);
  }
  const start = routes.indexOf("path: 'landlord/leases/build-lease-agreement'");
  assert.match(routes.slice(start, start + 220), /<BuildLeaseAgreementPage \/>/);
  parse(routes, { sourceType: 'module', plugins: ['jsx'] });
});

for (const scenario of ['success', 'changed', 'failed']) test(`real finalization handler: ${scenario}`, async () => {
  const calls = [];
  const completeLease = { ...lease, leaseAgreement: Object.fromEntries(agreementSections.map((section) => [section.flag, true])) };
  const latest = { lease: scenario === 'changed' ? { ...completeLease, rentAmount: null } : completeLease, locked: false };
  const bindings = { finishInFlight: { current: false }, ready: true, locked: false, canManage: true,
    leaseId: 7, mounted: { current: true }, setFinishing: (value) => calls.push(['finishing', value]),
    setError: (value) => { if (value) calls.push(['error', value]); },
    loadAgreementContext: async (id) => { calls.push(['refresh', id]); return latest; },
    axiosServices: { get() {} }, setContext: () => {}, readAgreement, agreementSections,
    areAllLeasePreflightChecksComplete, computeLeasePreflightChecks,
    requireAgreementData: (result) => { if (!result.success) throw new Error('save failed'); return result.data; },
    finishLeaseAgreement: async (...args) => { calls.push(['finish', ...args]); return scenario === 'failed' ? { success: false } : { success: true, data: { id: 99 } }; },
    setPreviewOpen: (value) => calls.push(['preview', value]), setFinished: (value) => calls.push(['finished', value]) };
  await Function(...Object.keys(bindings), `return (${arrow(read('../build-lease-agreement.jsx'), 'confirmComplete')})();`)(...Object.values(bindings));
  assert.equal(calls.some(([name]) => name === 'finished'), scenario === 'success');
  const finishCall = calls.find(([name]) => name === 'finish');
  if (scenario === 'changed') assert.equal(finishCall, undefined);
  else assert.deepEqual(finishCall, ['finish', 7]); // No copied lease field values in generation request.
  assert.equal(calls.some(([name]) => name === 'error'), scenario !== 'success');
  assert.deepEqual(calls.at(-1), ['finishing', false]);
});
test('percentage late-fee facts display percentage, not a fabricated flat dollar fee', () => {
  assert.equal(Object.fromEntries(agreementLeaseFacts({ ...lease, fees: [{ name: 'Late fee', feeType: 'PercentRent', percentValue: 5, amount: 0 }] })).Fees, 'Late fee: 5%');
});
test('agreement selection hands off the exact saved lease without claiming a fake creation success', () => {
  const source = read('../leases.jsx');
  parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const start = source.indexOf('function CreateLeaseAgreementDrawer');
  const selector = source.slice(start, source.indexOf('export default function LeasesPage', start));
  assert.match(selector, /result.set\(Number\(initialLease.id\), initialLease\)/);
  assert.match(selector, /onSetup\(selected\)/);
  assert.doesNotMatch(selector, /Created successfully|localStorage|axiosServices\.post/);
});

test('ordinary Add lease launches the full-page builder with scoped context; approved-application workflow is preserved', () => {
  const source = read('../../../components/drawers/LeaseAddDrawer.jsx');
  let callback;
  walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }), (node) => {
    if (node.type === 'CallExpression' && node.callee.name === 'useEffect') {
      const text = source.slice(node.arguments[0].start, node.arguments[0].end);
      if (text.includes('navigate(`/landlord/leases/builder')) callback = text;
    }
  });
  assert.ok(callback);
  for (const application of [null, { applicationId: 42 }]) {
    const calls = [];
    Function('drawer', 'selectedProperty', 'navigate', `return (${callback})();`)(
      { isOpenLeaseAdd: true, leaseAddApplicationContext: application, leaseAddProperty: { id: 10 }, leaseAddUnitId: 20,
        closeLeaseAddDrawer: () => calls.push('close') }, null, (path) => calls.push(path));
    assert.deepEqual(calls, application ? [] : ['close', '/landlord/leases/builder?propertyId=10&unitId=20']);
  }
});
