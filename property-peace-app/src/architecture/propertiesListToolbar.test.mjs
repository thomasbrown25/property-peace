import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const propertiesPage = new URL('../pages/landlord/properties.jsx', import.meta.url);

test('keeps property search and filters inside the property list surface', async () => {
  const source = await readFile(propertiesPage, 'utf8');
  const listSurface = source.indexOf("overflow: 'hidden'");
  const search = source.indexOf('placeholder="Search properties, addresses, or units"');
  const tableHeader = source.indexOf("['Property', 'Occupancy', 'Rent roll', 'Operations', '']");

  assert.notEqual(listSurface, -1, 'property list surface should exist');
  assert.notEqual(search, -1, 'property search should exist');
  assert.notEqual(tableHeader, -1, 'property list header should exist');
  assert.ok(search > listSurface, 'search and filters should be mounted inside the list surface');
  assert.ok(search < tableHeader, 'search and filters should appear above the list header');
  assert.match(source.slice(search, tableHeader), /<Divider\s*\/>/);
});
