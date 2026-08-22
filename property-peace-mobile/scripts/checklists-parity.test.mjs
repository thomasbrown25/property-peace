import assert from 'node:assert/strict';
import test from 'node:test';

let navigationModel;
let loadError;

try {
  navigationModel = await import('../src/features/checklists/checklistNavigationModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return navigationModel;
};

test('single-unit property selection produces property-level checklist params', () => {
  const { buildChecklistHomeParams } = required();
  assert.deepEqual(buildChecklistHomeParams({
    id: 7,
    name: 'Maple House',
    propertyType: 'SingleFamily',
  }), {
    propertyId: '7',
    propertyName: 'Maple House',
    propertyType: 'SingleFamily',
  });
});

test('multi-unit property selection cannot continue without an explicit unit', () => {
  const { buildChecklistHomeParams } = required();
  assert.throws(() => buildChecklistHomeParams({
    id: 8,
    name: 'River Flats',
    propertyType: 'MultiUnit',
  }), /select a unit/i);
});

test('multi-unit property selection retains property and unit identity', () => {
  const { buildChecklistHomeParams } = required();
  assert.deepEqual(buildChecklistHomeParams({
    id: 8,
    name: 'River Flats',
    propertyType: 'MultiUnit',
  }, { id: 12, name: 'Unit B' }), {
    propertyId: '8',
    propertyName: 'River Flats',
    propertyType: 'MultiUnit',
    unitId: '12',
    unitName: 'Unit B',
  });
});

test('preselection only returns an exact property id match', () => {
  const { findPreselectedProperty } = required();
  const properties = [{ id: 1, name: 'A' }, { Id: 2, Name: 'B' }];
  assert.equal(findPreselectedProperty(properties, '2'), properties[1]);
  assert.equal(findPreselectedProperty(properties, '3'), null);
  assert.equal(findPreselectedProperty(properties, undefined), null);
});
