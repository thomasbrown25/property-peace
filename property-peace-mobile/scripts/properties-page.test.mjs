import assert from 'node:assert/strict';
import test from 'node:test';

let filterPropertiesForList;
let loadError;

try {
  ({ filterPropertiesForList } = await import(
    '../src/features/properties/propertiesList.ts'
  ));
} catch (error) {
  loadError = error;
}

const properties = [
  { id: 1, name: 'Maple House', city: 'Columbus', isOccupied: true },
  { id: 2, name: 'River Flats', city: 'Dayton', isOccupied: false },
  { id: 3, name: 'Pine Court', city: 'Akron', isActive: false },
];

test('shows every property when the search is empty', () => {
  assert.equal(loadError, undefined);
  assert.deepEqual(
    filterPropertiesForList(properties, '').map((property) => property.id),
    [1, 2, 3],
  );
});

test('search remains the only list-narrowing control', () => {
  assert.equal(loadError, undefined);
  assert.deepEqual(
    filterPropertiesForList(properties, 'dayton').map((property) => property.id),
    [2],
  );
});
