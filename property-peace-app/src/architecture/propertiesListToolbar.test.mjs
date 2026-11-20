import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const propertiesPage = new URL('../pages/landlord/properties.jsx', import.meta.url);

test('property search and filters use the shared control style above the property list', async () => {
  const source = await readFile(propertiesPage, 'utf8');
  const filters = source.indexOf('data-testid="property-filters"');
  const table = source.indexOf('data-testid="property-table"');

  assert.ok(filters >= 0 && table > filters);
  const toolbar = source.slice(filters, table);
  assert.match(toolbar, /<TextField\b[\s\S]*?placeholder="Search properties, addresses, or units"[\s\S]*?type="search"[\s\S]*?input: \{\s*sx: filterControlSx/);
  assert.match(toolbar, /gridColumn: \{ xs: '1 \/ -1', md: 'auto' \}/);
  assert.doesNotMatch(toolbar, /overflowX:/);
  const dropdowns = [...toolbar.matchAll(/<Select\b[\s\S]*?<\/Select>/g)].map(([dropdown]) => dropdown);
  assert.deepEqual(dropdowns.map((dropdown) => dropdown.match(/value=\{(\w+)\}/)?.[1]), ['status', 'occupancy', 'attention', 'sort']);
  for (const dropdown of dropdowns) {
    assert.match(dropdown, /sx=\{filterControlSx\}/);
  }
});
