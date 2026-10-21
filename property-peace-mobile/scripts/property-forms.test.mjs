import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProperty, prefillProperty, propertyErrors, propertyPayload, emptyUnit, prefillUnit, unitErrors, unitPayload, nextUnitName, createPropertyErrors, initialUnitUpdates, bulkCreateWithReconciliation, BulkCreateUncertainError, locationErrors, buildingErrors, bulkUnitCountError, bulkUnitDrafts } from '../src/features/properties/propertyForms.ts';
import { readFileSync } from 'node:fs';

test('create property maps UI choices to backend DTO, trims address, and validates', () => {
  const draft = { ...emptyProperty(), name: ' Maple ', address: ' 1 Main ', city: ' Austin ', state: ' TX ', zipCode: ' 78701 ', propertyType: 'townhouse', yearBuilt: '1999' };
  assert.deepEqual(propertyErrors(draft), []);
  assert.deepEqual(propertyPayload(draft), { name: 'Maple', streetAddress: '1 Main', city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'singleFamily', yearBuilt: 1999, rentalMode: 'LongTerm' });
  assert.equal(propertyPayload({ ...draft, propertyType: 'apartmentBuilding' }).propertyType, 'multiUnit');
  assert.ok(propertyErrors({ ...draft, address: '', yearBuilt: 'xx' }).length > 0);
});
test('edit prefills from API casing and preserves DTO fields rather than erasing them', () => {
  const original = { Id: 8, Name: 'Old', StreetAddress: '2 Park', City: 'Austin', State: 'TX', ZipCode: '78702', PropertyType: 'multiUnit', YearBuilt: 1980, Description: 'Historic', TargetRent: 1500, LandlordId: 4 };
  const form = prefillProperty(original);
  assert.equal(form.address, '2 Park');
  assert.equal(form.propertyType, 'multiUnit');
  assert.deepEqual(propertyPayload({ ...form, name: 'New' }, original), { id: 8, name: 'New', streetAddress: '2 Park', city: 'Austin', state: 'TX', zipCode: '78702', propertyType: 'multiUnit', yearBuilt: 1980, description: 'Historic', targetRent: 1500, landlordId: 4 });
});
test('unit create/edit validates numeric values, includes API fields and preserves existing fields', () => {
  const draft = { ...emptyUnit('101'), bedrooms: '0', baths: '1.5', squareFeet: '850', rentAmount: '1200.50' };
  assert.deepEqual(unitErrors(draft), []);
  assert.deepEqual(unitPayload(draft, 9), { id: 0, propertyId: 9, name: '101', bedrooms: '0', baths: '1.5', squareFeet: 850, rentAmount: 1200.5, type: '', isOccupied: false, rentalMode: 'LongTerm', amenities: [], includedUtility: [] });
  assert.ok(unitErrors({ ...draft, squareFeet: '-4', rentAmount: 'abc' }).length > 0);
  const original = { Id: 3, Name: 'A', Bedrooms: '2', Baths: '1', SquareFeet: 700, RentAmount: 900, Type: 'Flat', IsOccupied: true, Amenities: [{ id: 1 }], IncludedUtility: [{ id: 2 }] };
  const edited = unitPayload({ ...prefillUnit(original), name: 'B' }, 9, original);
  assert.deepEqual(edited, { id: 3, propertyId: 9, name: 'B', bedrooms: '2', baths: '1', squareFeet: 700, rentAmount: 900, type: 'Flat', isOccupied: true, amenities: [{ id: 1 }], includedUtility: [{ id: 2 }] });
  assert.equal(nextUnitName([{ Name: 'Unit 2' }, { name: '7' }]), '8');
});
test('wizard validates location before building and creates numbered bulk units without extra updates', () => {
  const form = { ...emptyProperty(), name: 'Maple', address: '1 Main', city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'apartmentBuilding', yearBuilt: 'not a year' };
  assert.deepEqual(locationErrors(form), []);
  assert.match(buildingErrors(form).join(' '), /year built/);
  assert.match(locationErrors({ ...form, city: '' }).join(' '), /City/);
  for (const invalid of ['', '0', '-1', '1.5', 'abc', '51']) {
    assert.ok(bulkUnitCountError(invalid));
    assert.deepEqual(bulkUnitDrafts(invalid), []);
  }
  const drafts = bulkUnitDrafts('3');
  assert.deepEqual(drafts.map(unit => unit.name), ['Unit 1', 'Unit 2', 'Unit 3']);
  assert.equal(propertyPayload(form, undefined, drafts.length).unitCount, 3);
  assert.deepEqual(initialUnitUpdates(drafts, [{ id: 9, name: 'Unit 2' }, { id: 8, name: 'Unit 1' }, { id: 10, name: 'Unit 3' }], 5), []);
  const screen = readFileSync(new URL('../src/screens/landlord/AddPropertyScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /step === 0 \? 'Property location' : step === 1 \? 'Building' : 'Units'/);
  assert.match(screen, /onPress=\{isCreating && \(step === 0 \|\| step === 1 && multiUnit\) \? next : save\}/);
  assert.match(screen, /applyGooglePlaceDetails/);
});

test('multi-unit create sends a positive count matching backend-created rows', () => {
  const form = { ...emptyProperty(), propertyType: 'apartmentBuilding' };
  const units = [emptyUnit('1'), emptyUnit('2')];
  assert.equal(propertyPayload(form, undefined, units.length).unitCount, 2);
  assert.ok(createPropertyErrors(form, []).some(error => /unit/i.test(error)));
  assert.deepEqual(createPropertyErrors(form, units), []);
  assert.ok(createPropertyErrors(form, [{ ...emptyUnit('1'), squareFeet: '-10' }]).some(error => /square feet/i.test(error)));
});
test('single-family create only updates existing backend unit', () => {
  const form = emptyProperty();
  assert.equal(propertyPayload(form, undefined, 1).unitCount, undefined);
  assert.ok(createPropertyErrors(form, [emptyUnit('1'), emptyUnit('2')]).length);
  assert.deepEqual(initialUnitUpdates([emptyUnit('1')], [{ id: 77, name: 'Unit 1' }], 9), []);
  const draft = { ...emptyUnit('Home'), bedrooms: '2', baths: '1' };
  assert.deepEqual(initialUnitUpdates([draft], [{ id: 77, name: 'Unit 1' }], 9).map(unit => unit.id), [77]);
  assert.throws(() => initialUnitUpdates([draft], [], 9), /existing unit/i);
});
test('multi-unit retry reuses backend-generated IDs, never inserts rows', () => {
  const drafts = [{ ...emptyUnit('A'), bedrooms: '1', baths: '1' }, { ...emptyUnit('B'), bedrooms: '2', baths: '2' }];
  const existing = [{ Id: 4, Name: 'Unit 1' }, { Id: 5, Name: 'Unit 2' }];
  const first = initialUnitUpdates(drafts, existing, 9);
  assert.deepEqual(first.map(unit => unit.id), [4, 5]);
  assert.deepEqual(initialUnitUpdates(drafts, existing, 9), first);
  assert.deepEqual(initialUnitUpdates(drafts, [{ Id: 5, Name: 'Unit 2' }, { Id: 4, Name: 'A' }], 9).map(unit => unit.id), [4, 5]);
  assert.throws(() => initialUnitUpdates(drafts, existing.slice(0, 1), 9), /existing unit/i);
});
test('create screen never inserts replacement rows after property creation', () => {
  const screen = readFileSync(new URL('../src/screens/landlord/AddPropertyScreen.tsx', import.meta.url), 'utf8');
  const createBranch = screen.split('// Keep the new ID')[1]?.split('navigation.goBack()')[0];
  assert.ok(createBranch?.includes('initialUnitUpdates('));
  assert.ok(!createBranch?.includes('bulkCreate('));
  assert.ok(!createBranch?.includes('unitPayload(units[0], id)'));
});
test('bulk add snapshots IDs before POST and recognizes committed rows after lost response', async () => {
  const drafts = [{ ...emptyUnit('A'), bedrooms: '1', baths: '1' }, { ...emptyUnit('B'), bedrooms: '2', baths: '2' }];
  const events = [];
  let rows = [{ Id: 1, Name: 'Old' }];
  const load = async () => { events.push('load'); return rows; };
  const post = async (id, payload) => {
    events.push('post');
    assert.equal(id, 9);
    assert.deepEqual(payload.map(unit => unit.name), ['A', 'B']);
    rows = [...rows, { Id: 2, Name: 'A' }, { id: 3, name: 'B' }];
    throw Error('network timeout');
  };
  await bulkCreateWithReconciliation(9, drafts, load, post);
  assert.deepEqual(events, ['load', 'post', 'load']);
});
test('bulk add refuses to resend an ambiguous request, even when no rows appear yet', async () => {
  const drafts = [{ ...emptyUnit('A'), bedrooms: '1', baths: '1' }];
  for (const after of [[], [{ id: 2, name: 'Other' }], [{ id: 2, name: 'A' }, { id: 3, name: 'A' }], [{ id: 2, name: 'Unit 2' }]]) {
    let calls = 0;
    let reads = 0;
    await assert.rejects(bulkCreateWithReconciliation(9, drafts,
      async () => ++reads === 1 ? [{ id: 1, name: 'Old' }] : [{ id: 1, name: 'Old' }, ...after],
      async () => { calls++; throw Error('timeout'); }),
    error => error instanceof BulkCreateUncertainError && /reload/i.test(error.message));
    assert.equal(calls, 1);
    assert.equal(reads, 2);
  }
});
test('bulk add fails closed when reconciliation cannot fetch current rows', async () => {
  let reads = 0;
  await assert.rejects(bulkCreateWithReconciliation(9, [emptyUnit('A')],
    async () => { if (++reads === 2) throw Error('offline'); return []; },
    async () => { throw Error('timeout'); }), error => error instanceof BulkCreateUncertainError && /reload/i.test(error.message));
});
test('bulk add does not POST if snapshot is incomplete or requested names already exist', async () => {
  let calls = 0;
  for (const rows of [[{ name: 'Old' }], [{ id: 1, name: ' a ' }]]) {
    await assert.rejects(bulkCreateWithReconciliation(9, [emptyUnit('A')], async () => rows,
      async () => { calls++; }), /reload|already exists/i);
  }
  assert.equal(calls, 0);
});
test('bulk add fails closed for partial creation and prevents screen retry', async () => {
  const drafts = [emptyUnit('A'), emptyUnit('B')];
  let reads = 0;
  await assert.rejects(bulkCreateWithReconciliation(9, drafts,
    async () => ++reads === 1 ? [{ id: 1, name: 'Old' }] : [{ id: 1, name: 'Old' }, { id: 2, name: 'A' }],
    async () => { throw Error('timeout'); }), error => error instanceof BulkCreateUncertainError);
  const screen = readFileSync(new URL('../src/screens/landlord/AddPropertyScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /await bulkCreateWithReconciliation\(propertyId, units,/);
  assert.match(screen, /if \(e instanceof BulkCreateUncertainError\) setBulkRetryBlocked\(true\)/);
  assert.match(screen, /disabled=\{saving \|\| bulkRetryBlocked/);
});
test('successful bulk add performs one snapshot and one POST', async () => {
  let reads = 0;
  let posts = 0;
  await bulkCreateWithReconciliation(9, [emptyUnit('A')], async () => { reads++; return []; }, async () => { posts++; return []; });
  assert.equal(reads, 1);
  assert.equal(posts, 1);
});
