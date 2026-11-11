import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { leaseTermError } from '../../utils/successorLease.mjs';
import { readSetup, setupId } from './leaseSetup.mjs';
import { persistLeaseSetup, setupDefaults, setupDestinations, setupFromLease, setupPayload } from './leaseSetup.mjs';
const require = createRequire(import.meta.url);
const values = () => ({ ...setupDefaults(), propertyId: 10, unitId: 20, startDate: '2027-01-01', endDate: '2028-01-01', rentAmount: 1500 });

test('new lease payload owns operational fields but does not create agreement metadata', () => {
  const payload = setupPayload(values(), null, 7);
  assert.equal(payload.id, 0);
  assert.equal(payload.organizationId, 7);
  assert.equal(payload.leaseLength, 12);
  assert.equal(payload.startDate, '2027-01-01T00:00:00');
  assert.equal(payload.rentAmount, 1500);
  assert.equal('isDrafted' in payload, false);
  assert.equal('leaseAgreement' in payload, false);
  assert.equal('termType' in payload, false);
});
test('month-to-month stores open end date, -1 length, and disables renewal', () => {
  const payload = setupPayload({ ...values(), termType: 'monthly', autoRenewLease: true, autoRenewRentIncrement: true });
  assert.equal(payload.endDate, null);
  assert.equal(payload.leaseLength, -1);
  assert.equal(payload.autoRenewLease, false);
  assert.equal(payload.autoRenewRentIncrement, false);
});
test('edit hydrates current GET, keeps zeroes and all people/fee collections, preserves unrelated operational fields', () => {
  const lease = { Id: 42, PropertyId: 10, UnitId: 20, StartDate: '2027-01-01T00:00:00', EndDate: null, LeaseLength: -1,
    RentAmount: 0, IsActive: false, OperatingAccountId: 123, PetsAllowed: true, IsDrafted: true,
    LeaseAgreement: { isPeopleOnLeaseComplete: true }, LeaseCoSigners: [{ FirstName: 'Pat', LastName: 'Lee' }],
    LeaseLandlords: [{ FirstName: 'Owner' }], LeaseOccupants: [{ FirstName: 'Child' }], Fees: [{ Name: 'Fee', Amount: 0 }] };
  const form = setupFromLease(lease);
  assert.equal(form.termType, 'monthly');
  assert.equal(form.rentAmount, 0);
  assert.equal(form.leaseCoSigners[0].firstName, 'Pat');
  const payload = setupPayload(form, lease, 7);
  assert.equal(payload.id, 42);
  assert.equal(payload.operatingAccountId, 123);
  assert.equal(payload.petsAllowed, true);
  assert.equal(payload.isActive, false);
  assert.equal(payload.fees[0].amount, 0);
  assert.equal(payload.leaseOccupants[0].firstName, 'Child');
  assert.equal('isDrafted' in payload, false);
  assert.equal('leaseAgreement' in payload, false);
});
test('success is available only after real saved ID and every tenant link succeeds', async () => {
  const calls = [];
  const checkpoint = { leaseId: null, linked: new Set() };
  const result = await persistLeaseSetup({ payload: setupPayload(values()), tenants: [{ id: 1 }, { id: 2 }], checkpoint,
    saveLease: async (payload) => { calls.push(['save', payload.id]); return { success: true, data: { id: 99 } }; },
    linkTenant: async (id, tenant) => { calls.push(['link', id, tenant]); return { success: true }; } });
  assert.deepEqual(calls, [['save', 0], ['link', 99, 1], ['link', 99, 2]]);
  assert.deepEqual(setupDestinations(result), { view: '/landlord/leases/99', agreement: '/landlord/leases/build-lease-agreement?leaseId=99&propertyId=10&unitId=20' });
});
test('partial linking retains actual lease ID and retry never duplicates lease or successful links', async () => {
  const checkpoint = { leaseId: null, linked: new Set() };
  const calls = [];
  let fail = true;
  const args = { payload: setupPayload(values()), tenants: [{ id: 1 }, { id: 2 }], checkpoint,
    saveLease: async () => { calls.push('save'); return { success: true, data: { id: 88 } }; },
    linkTenant: async (id, tenant) => { calls.push([id, tenant]); if (tenant === 2 && fail) throw new Error('network'); return { success: true }; } };
  await assert.rejects(persistLeaseSetup(args), /network/);
  assert.equal(checkpoint.leaseId, 88);
  assert.deepEqual([...checkpoint.linked], [1]);
  fail = false;
  assert.equal((await persistLeaseSetup(args)).id, 88);
  assert.deepEqual(calls, ['save', [88, 1], [88, 2], [88, 2]]);
});
test('application-level link failure is not reported as successful creation', async () => {
  const checkpoint = { leaseId: null, linked: new Set() };
  await assert.rejects(persistLeaseSetup({ payload: setupPayload(values()), tenants: [{ id: 3 }], checkpoint,
    saveLease: async () => ({ success: true, data: { Id: 9 } }), linkTenant: async () => ({ success: false, message: 'Denied' }) }), /Denied/);
  assert.equal(checkpoint.leaseId, 9);
  assert.equal(checkpoint.linked.size, 0);
});
test('save failure and missing saved ID never link tenants', async () => {
  for (const response of [{ success: false }, { success: true, data: {} }]) {
    let linked = false;
    await assert.rejects(persistLeaseSetup({ payload: setupPayload(values()), tenants: [{ id: 3 }],
      checkpoint: { leaseId: null, linked: new Set() }, saveLease: async () => response,
      linkTenant: async () => { linked = true; } }));
    assert.equal(linked, false);
  }
  assert.throws(() => setupDestinations({ id: null }), /Saved lease context/);
});
test('edit removes deselected links and does not re-add existing tenants', async () => {
  const calls = [];
  const result = await persistLeaseSetup({ payload: setupPayload(values(), { id: 22 }), tenants: [{ id: 1 }, { id: 3 }],
    checkpoint: { leaseId: null, linked: new Set([1, 2]) },
    saveLease: async (payload) => { calls.push(['save', payload.id]); return { success: true, data: { id: 22 } }; },
    unlinkTenant: async (id, tenant) => { calls.push(['remove', id, tenant]); return { success: true }; },
    linkTenant: async (id, tenant) => { calls.push(['add', id, tenant]); return { success: true }; } });
  assert.equal(result.id, 22);
  assert.deepEqual(calls, [['save', 22], ['remove', 22, 2], ['add', 22, 3]]);
});
test('production validation enforces authority, short-term exclusion, financials, people, and successor terms', () => {
  const source = readFileSync(new URL('./LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
  const ast = require('@babel/parser').parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let validateNode;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'validate') validateNode = node.init;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(ast);
  assert.ok(validateNode);
  const validate = (overrides = {}) => vm.runInNewContext(`(${source.slice(validateNode.start, validateNode.end)})()`, {
    canManage: true, property: { id: 10 }, unit: { id: 20 }, existing: null,
    values: { ...values(), addTenantsLater: true }, tenants: [], readSetup, setupId, leaseTermError,
    rentalMode: (unit) => unit.rentalMode || 'longTerm', ...overrides
  });
  assert.equal(validate(), null);
  assert.match(validate({ canManage: false }), /permission/);
  assert.match(validate({ unit: { id: 20, rentalMode: 'shortTerm' } }), /Short-term/);
  assert.match(validate({ values: { ...values(), rentAmount: -1 } }), /rent amount/);
  assert.match(validate({ values: { ...values(), rentDueDay: 32 } }), /between 1 and 31/);
  assert.match(validate({ values: { ...values(), addTenantsLater: false } }), /at least one tenant/);
  const current = { id: 44, startDate: '2026-01-01', endDate: '2027-06-01', isActive: true };
  assert.match(validate({ unit: { id: 20, lease: current } }), /current lease end date/);
  assert.equal(validate({ existing: current, unit: { id: 20, lease: current, leases: [current] } }), null);
});
test('missing saved ID prevents a second save attempt', async () => {
  let saves = 0;
  const args = { payload: setupPayload(values()), tenants: [], checkpoint: { leaseId: null, linked: new Set() },
    saveLease: async () => { saves++; return { success: true, data: {} }; } };
  await assert.rejects(persistLeaseSetup(args));
  await assert.rejects(persistLeaseSetup(args), /Check your leases/);
  assert.equal(saves, 1);
});
test('page and builder parse, use full section navigation and real APIs, exclude short-term units, retain authority checks', () => {
  const parser = require('@babel/parser');
  const source = readFileSync(new URL('./LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../../pages/landlord/lease-builder.jsx', import.meta.url), 'utf8');
  parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  parser.parse(page, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(source, /hasPermission\('CanManageLeases'\)/);
  assert.match(source, /rentalMode\(unit\) === 'shortTerm'/);
  assert.match(source, /isDetachedSingleUnitType/);
  assert.match(source, /axiosServices.get\(`\/api\/Lease\/by-id\/\$\{leaseId\}`\)/);
  assert.match(source, /persistLeaseSetup/);
  assert.match(source, /CheckCircleOutlined/);
  assert.match(source, /View lease/);
  assert.match(source, /Create lease agreement/);
  assert.match(source, /component="nav"/);
  assert.doesNotMatch(page, /LeaseBuilderWizard|maxWidth: 600/);
});
