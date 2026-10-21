import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isShortTermOnlyPortfolio, landlordPagesForInventory } from './landlordInventory.js';

const pages = [
  { id: 'primary', children: [{ id: 'dashboard' }, { id: 'properties-page' }, { id: 'leases' }, { id: 'listings' }] },
  { id: 'other', children: [{ id: 'finances' }] }
];
const ids = (groups) => groups.flatMap((group) => group.children.map((child) => child.id));
const scoped = (properties, loadedOrganizationId = 7, organizationId = 7, loadedAt = 123) => ({ properties, loadedOrganizationId, organizationId, loadedAt });

test('hide only the two long-term primary entries for an authorized short-term-only portfolio', () => {
  assert.equal(isShortTermOnlyPortfolio(scoped([{ units: [{ rentalMode: 'shortTerm' }] }, { Units: [{ RentalMode: 'shortTerm' }] }])), true);
  const filtered = landlordPagesForInventory(pages, true);
  assert.deepEqual(ids(filtered), ['dashboard', 'properties-page', 'finances']);
  assert.deepEqual(ids(pages), ['dashboard', 'properties-page', 'leases', 'listings', 'finances']);
  assert.notEqual(filtered[0], pages[0]);
});

test('mixed, long-term, legacy missing mode, no units and no properties retain long-term navigation', () => {
  for (const properties of [
    [{ units: [{ rentalMode: 'shortTerm' }, { rentalMode: 'longTerm' }] }],
    [{ units: [{}] }],
    [{ units: [{ rentalMode: 'longTerm' }] }],
    [{ units: [] }],
    []
  ]) {
    assert.equal(isShortTermOnlyPortfolio(scoped(properties)), false);
    assert.deepEqual(ids(landlordPagesForInventory(pages, false)), ids(pages));
  }
});

test('unloaded, missing or mismatched organization inventory never hides links', () => {
  const shortTerm = [{ units: [{ rentalMode: 'shortTerm' }] }];
  for (const state of [scoped(shortTerm, 8), scoped(shortTerm, null), scoped(shortTerm, 7, null), scoped(shortTerm, 7, 7, null), scoped(shortTerm, '7', null), scoped(null)]) {
    assert.equal(isShortTermOnlyPortfolio(state), false);
  }
  assert.equal(isShortTermOnlyPortfolio(scoped(shortTerm, '7', 7)), true);
});

test('drawer uses scoped inventory and mobile More navigation filters the same entries; routes remain untouched', () => {
  const drawer = readFileSync(new URL('../layout/Dashboard/Drawer/DrawerContent/Navigation/index.jsx', import.meta.url), 'utf8');
  const mobile = readFileSync(new URL('../layout/Dashboard/BottomNavBar/index.jsx', import.meta.url), 'utf8');
  assert.match(drawer, /useLandlordInventoryMenu/);
  assert.match(drawer, /landlordPagesForInventory/);
  assert.match(mobile, /useLandlordInventoryMenu/);
  assert.match(mobile, /landlordPagesForInventory/);
  const routes = readFileSync(new URL('../routes/MainRoutes.jsx', import.meta.url), 'utf8');
  assert.match(routes, /path: 'landlord\/leases'/);
  assert.match(routes, /path: 'landlord\/listings'/);
});
