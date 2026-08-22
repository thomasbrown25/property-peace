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

test('property detail opens single-unit checklists directly', () => {
  const { buildPropertyChecklistEntry } = required();
  assert.deepEqual(buildPropertyChecklistEntry({
    id: 14,
    name: 'Oak House',
    propertyType: 'SingleFamily',
  }), {
    screen: 'PropertyChecklists',
    params: {
      propertyId: '14',
      propertyName: 'Oak House',
      propertyType: 'SingleFamily',
    },
  });
});

test('property detail requires unit selection for multi-unit properties', () => {
  const { buildPropertyChecklistEntry } = required();
  assert.deepEqual(buildPropertyChecklistEntry({
    Id: 15,
    Name: 'Oak Flats',
    PropertyType: 'MultiUnit',
  }), {
    screen: 'ChecklistPropertySearch',
    params: { preselectedPropertyId: '15' },
  });
});
