import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { emptyLandlord, landlordsFromLease, landlordError, landlordPayload } from './landlordDetails.mjs';
import { setupDefaults, setupFromLease, setupPayload } from '../../../sections/lease-builder/leaseSetup.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = fs.readFileSync(new URL('./landlords.jsx', import.meta.url), 'utf8');
const walk = (node, fn) => { if (!node || typeof node !== 'object') return; fn(node); for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach((v) => walk(v, fn)); else if (typeof value === 'object') walk(value, fn); } };
let save;
walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }), (node) => {
  if (node.type === 'VariableDeclarator' && node.id.name === 'save') save = source.slice(node.init.start, node.init.end);
});
const landlord = { ...emptyLandlord(), firstName: 'Pat', lastName: 'Owner', email: 'pat@example.com' };
test('agreement hydrates saved landlords with either DTO casing, without child identity in PATCH', () => {
  const people = landlordsFromLease({ LeaseLandlords: [{ Id: 12, LeaseId: 7, EntityType: 'Company', CompanyName: 'Owner LLC', Unit: 'Suite 2' }] });
  assert.equal(people[0].companyName, 'Owner LLC');
  assert.equal(people[0].unit, 'Suite 2');
  const payload = landlordPayload(people);
  assert.equal(payload.isPeopleOnLeaseComplete, true);
  assert.equal(payload.leaseLandlords[0].sortOrder, 0);
  assert.equal(payload.leaseLandlords[0].email, null);
  assert.deepEqual(Object.keys(payload), ['isPeopleOnLeaseComplete', 'leaseLandlords']);
  for (const key of ['id', 'leaseId', 'organizationId']) assert.equal(Object.hasOwn(payload.leaseLandlords[0], key), false);
});
test('new agreement prefill is not automatically saved and validates landlord identity', () => {
  assert.equal(landlordsFromLease({}, { firstname: 'Pat', lastname: 'Owner' })[0].firstName, 'Pat');
  assert.ok(landlordError([]));
  assert.ok(landlordError([emptyLandlord()]));
  assert.ok(landlordError([{ ...landlord, lastName: '' }]));
  assert.ok(landlordError([{ ...landlord, email: 'invalid' }]));
  assert.ok(landlordError([{ ...landlord, entityType: 'Other' }]));
  assert.equal(landlordError([landlord]), null);
  assert.equal(landlordError([{ ...emptyLandlord(), entityType: 'Company', companyName: 'Owner LLC' }]), null);
});
test('operational lease creation and edits omit landlords, leaving API-preserved agreement landlords untouched', () => {
  const lease = { id: 7, propertyId: 10, unitId: 20, startDate: '2026-01-01', endDate: '2026-12-31', leaseLandlords: [landlord] };
  for (const values of [setupDefaults(), setupFromLease(lease)]) {
    const payload = setupPayload({ ...values, startDate: '2026-01-01', endDate: '2026-12-31' }, lease);
    assert.equal(Object.hasOwn(payload, 'leaseLandlords'), false);
  }
  const setup = fs.readFileSync(new URL('../../../sections/lease-builder/LeaseSetupBuilder.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(setup, /rows\('leaseLandlords'|values\.leaseLandlords/);
});
for (const scenario of ['success', 'api-failure', 'refresh-failure', 'invalid', 'in-flight']) test(`real landlord save handler: ${scenario}`, async () => {
  const calls = [];
  const inFlight = { current: scenario === 'in-flight' };
  const bindings = { inFlight, loading: false, lease: { id: 7 }, leaseId: 7,
    landlords: scenario === 'invalid' ? [] : [landlord], landlordError, landlordPayload,
    setError: (message) => calls.push(['error', message]), setSaving: (value) => calls.push(['saving', value]),
    dispatch: async (v) => v,
    updateLeaseAgreement: (id, payload) => { calls.push(['patch', id, payload]); return { success: scenario !== 'api-failure', message: 'Failed' }; },
    onSaved: async () => { if (scenario === 'refresh-failure') throw new Error('Refresh failed'); calls.push(['saved']); }
  };
  await Function(...Object.keys(bindings), `return (${save})();`)(...Object.values(bindings));
  assert.equal(calls.some(([name]) => name === 'saved'), scenario === 'success');
  assert.equal(calls.some(([name]) => name === 'patch'), !['invalid', 'in-flight'].includes(scenario));
  if (!['invalid', 'in-flight'].includes(scenario)) {
    assert.deepEqual(calls.at(-1), ['saving', false]);
    assert.equal(inFlight.current, false);
  }
  assert.equal(bindings.landlords.length, scenario === 'invalid' ? 0 : 1);
});
