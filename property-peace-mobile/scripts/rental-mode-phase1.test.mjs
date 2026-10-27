import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyProperty, propertyPayload, emptyUnit, unitPayload, initialUnitUpdates, bulkUnitDrafts, createPropertyErrors } from '../src/features/properties/propertyForms.ts';
import { unitRentalMode, propertyRentalMode, rentalModeDecision, rentalModeMutationError, longTermTenants, longTermPayments } from '../src/features/properties/rentalMode.ts';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('creation mode is independent of building type and only seeds on create', () => {
  const form = { ...emptyProperty(), rentalMode: 'ShortTerm', propertyType: 'apartmentBuilding' };
  assert.equal(propertyPayload(form, undefined, 2).propertyType, 'multiUnit');
  assert.equal(propertyPayload(form, undefined, 2).rentalMode, 'ShortTerm');
  assert.equal(propertyPayload({ ...form, propertyType: 'singleFamily' }).rentalMode, 'ShortTerm');
  assert.equal('rentalMode' in propertyPayload(form, { id: 4 }), false);
});
test('existing units default long term; new and edited short-term units retain mode without unguarded edit mutation', () => {
  assert.equal(unitRentalMode({ id: 1 }), 'LongTerm');
  assert.equal(unitRentalMode({ RentalMode: 'ShortTerm' }), 'ShortTerm');
  assert.equal(propertyRentalMode([{ rentalMode: 'ShortTerm' }, { rentalMode: 'LongTerm' }]), 'Mixed');
  assert.equal(propertyRentalMode([{ RentalMode: 'ShortTerm' }]), 'ShortTerm');
  assert.equal(propertyRentalMode([]), 'Empty');
  const draft = { ...emptyUnit('A'), rentalMode: 'ShortTerm', rentAmount: '' };
  assert.equal(unitPayload(draft, 3).rentalMode, 'ShortTerm');
  assert.equal(unitPayload({ ...draft, rentAmount: '900', isOccupied: true }, 3).rentAmount, 0);
  assert.equal(unitPayload({ ...draft, rentAmount: '900', isOccupied: true }, 3).isOccupied, false);
  assert.equal('rentalMode' in unitPayload(draft, 3, { id: 5, rentalMode: 'LongTerm' }), false);
  assert.equal(unitPayload({ ...draft, rentAmount: '900' }, 3, { id: 5, rentalMode: 'ShortTerm', rentAmount: 75 }).rentAmount, 75);
  assert.equal(initialUnitUpdates([draft], [{ id: 7, name: 'Unit 1', rentalMode: 'ShortTerm' }], 3).length, 1);
  assert.equal(bulkUnitDrafts('2', 'ShortTerm')[1].rentalMode, 'ShortTerm');
});
test('preflight fail closed; blockers have actionable resolutions and confirmation is separate', () => {
  assert.equal(rentalModeDecision({ canChange: false, blockers: [{ code: 'lease', message: 'Active lease', resolution: 'End lease' }] }).kind, 'blocked');
  assert.match(rentalModeDecision({ canChange: false, blockers: [{ code: 'lease', message: 'Active lease', resolution: 'End lease' }] }).message, /End lease/);
  assert.equal(rentalModeDecision({ canChange: true, blockers: [], confirmationMessage: 'History retained' }).kind, 'confirm');
  assert.equal(rentalModeDecision({ canChange: true, blockers: [{ message: 'Pending payment', resolution: 'Resolve' }] }).kind, 'blocked');
  assert.equal(rentalModeDecision({ canChange: false, blockers: [] }).kind, 'blocked');
});
test('screen wiring uses preflight, confirms mutation, shows mixed overview and limits lease UI', () => {
  const add = source('../src/screens/landlord/AddPropertyScreen.tsx');
  const detail = source('../src/screens/landlord/PropertyDetailScreen.tsx');
  const api = source('../src/api/unitAPI.ts');
  assert.match(add, /Rental mode/);
  assert.match(add, /propertyPayload\(form, undefined, draftUnits.length\)/);
  assert.match(detail, /UnitAPI\.rentalModePreflight/);
  assert.match(detail, /UnitAPI\.changeRentalMode/);
  assert.match(detail, /rentalModeDecision/);
  assert.match(detail, /propertyRentalMode/);
  assert.match(detail, /hasLongTerm/);
  assert.match(api, /targetMode.*confirmed/);
});
test('creation validates effective selected mode rather than hidden stale long-term rent', () => {
  const form = { ...emptyProperty(), propertyType: 'apartmentBuilding', rentalMode: 'ShortTerm' };
  const stale = { ...emptyUnit('A', 'LongTerm'), bedrooms: '2', rentAmount: 'bad' };
  assert.deepEqual(createPropertyErrors(form, [stale]), []);
  assert.match(createPropertyErrors({ ...form, rentalMode: 'LongTerm' }, [stale]).join(' '), /valid rent/);
  assert.equal(unitPayload({ ...stale, rentalMode: form.rentalMode }, 4).rentAmount, 0);
  assert.match(source('../src/screens/landlord/AddPropertyScreen.tsx'), /units\.map\(unit => \(\{ \.\.\.unit, rentalMode: form\.rentalMode/);
});
test('mutation-time API 409 body surfaces new blockers including resolution', () => {
  const body = { message: 'Conflict', data: { canChange: false, blockers: [{ message: 'Active lease', resolution: 'End lease first' }] } };
  assert.match(rentalModeMutationError(body), /Active lease[\s\S]*End lease first/);
  assert.match(rentalModeMutationError({ response: { data: body } }), /End lease first/);
  assert.equal(rentalModeMutationError({ message: 'Offline' }), 'Offline');
  assert.match(source('../src/screens/landlord/PropertyDetailScreen.tsx'), /rentalModeMutationError\(error\)/);
});
test('mixed property tenant and payment views restrict rows to known long-term units', () => {
  const units = [{ id: 1, name: 'Lease A', rentalMode: 'LongTerm' }, { id: 2, name: 'Stay B', rentalMode: 'ShortTerm' }];
  const tenants = [{ id: 10, unitId: 1 }, { id: 11, UnitId: 2 }, { id: 12 }];
  assert.deepEqual(longTermTenants(tenants, units).map(t => t.id), [10]);
  const payments = [{ unitName: 'Stay B' }, { unitName: 'Lease A' }, { unitName: null }];
  assert.deepEqual(longTermPayments(payments, units), [payments[1]]);
  assert.deepEqual(longTermPayments(payments, [{ id: 1, name: 'Lease A' }, { id: 2, name: 'Lease A', rentalMode: 'ShortTerm' }]), []);
  const records = [{ unitName: 'Stay B', propertyId: 5, rentDue: 200 }, { unitName: 'Lease A', propertyId: 5, rentDue: 100 }];
  assert.deepEqual(longTermPayments(records, units), [records[1]]);
  const detail = source('../src/screens/landlord/PropertyDetailScreen.tsx');
  assert.match(detail, /mixed \? longTermTenants\(/);
  assert.match(detail, /mixed \? longTermPayments\(paymentResult\.value/);
  assert.match(detail, /mixed \? longTermPayments\(rentResult\.value/);
});
