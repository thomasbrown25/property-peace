import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const surfaces = [
  'components/cards/PropertyCard.jsx',
  'components/cards/PropertyUnitCard.jsx',
  'components/property/PropertiesTableView.jsx',
  'pages/landlord/unit.jsx',
  'sections/landlord/property/OverviewTab.jsx',
  'sections/landlord/properties/PropertiesMetrics.jsx',
  'sections/landlord/properties/PropertiesOverviewCards.jsx',
  'sections/landlord/properties/UnitsOverviewCards.jsx',
  'sections/landlord/properties/PropertyListCard.jsx'
];

for (const path of surfaces) {
  test(`${path} parses and uses shared occupancy without cached flags`, () => {
    const source = read(path);
    assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }));
    assert.match(source, /from 'utils\/occupancy\.mjs'/);
    assert.doesNotMatch(source, /\?*\.(?:isOccupied|IsOccupied)\b/);
  });
}

test('PropertyCard occupied numerator does not add overdue financial records', () => {
  const source = read('components/cards/PropertyCard.jsx');
  assert.match(source, /\$\{multiUnitCounts\.occupiedCount\}\/\$\{multiUnitCounts\.total\} occupied/);
  assert.doesNotMatch(source, /occupiedCount\s*\+\s*multiUnitCounts\.overdueCount/);
  assert.match(source, /const isOverdue = propertyRent\.overdueCount > 0/);
  assert.match(source, /text: 'Rent overdue'/);
});

test('unit overview uses shared counts and a unit-weighted occupancy rate', () => {
  const source = read('sections/landlord/properties/UnitsOverviewCards.jsx');
  assert.match(source, /getPropertyOccupancy\(property\)/);
  assert.match(source, /sum \+ occupancy\.occupiedUnits/);
  assert.match(source, /vacantUnits = totalUnits - occupiedUnits/);
  assert.match(source, /Math\.round\(\(occupiedUnits \/ totalUnits\) \* 100\)/);
  assert.doesNotMatch(source, /tenantId|calculateOccupancyPercentage/);
});

test('list card retains overdue attention independently of occupied count', () => {
  const source = read('sections/landlord/properties/PropertyListCard.jsx');
  assert.match(source, /occupiedUnits: occupied, vacantUnits: vacant, totalUnits: total/);
  assert.match(source, /const overdue = units\.filter/);
  assert.doesNotMatch(source, /occupied\+\+|vacant\+\+/);
  assert.match(source, /const hasOverdue = overdue > 0/);
});
