import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const model = readFileSync(new URL('../src/features/rentCollection/propertyCollection.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
const rail = readFileSync(new URL('../src/screens/landlord/PropertyCollectionRail.tsx', import.meta.url), 'utf8');

test('collection groups per-lease current-month credits by property and refuses incomplete data', async () => {
  const { propertyCollection } = await import('../src/features/rentCollection/propertyCollection.ts');
  const values = propertyCollection({ RentRecords: [
    { PropertyId: 2, CurrentMonthExpected: 1000, CurrentMonthCollected: 400, OverdueAmount: 10 },
    { PropertyId: 2, CurrentMonthExpected: 800, CurrentMonthCollected: 800, OverdueAmount: 0 },
    { PropertyId: 3, CurrentMonthExpected: 0, CurrentMonthCollected: 0, OverdueAmount: 0 },
  ] });
  assert.deepEqual(values?.get('2'), { propertyId: '2', expected: 1800, collected: 1200, overdue: 10 });
  assert.equal(values?.get('3')?.expected, 0);
  assert.equal(propertyCollection({ rentRecords: [{ propertyId: 2, rentAmount: 1000 }] }), null);
  assert.equal(propertyCollection({}), null);
});

test('dashboard shows only properties with a currently active lease, preserving their order', async () => {
  const { dashboardPropertiesWithActiveLeasesFirst, dashboardPropertiesWithActiveLeases, hasActiveLease } = await import('../src/features/properties/dashboardPropertyOrder.ts');
  const properties = [
    { id: 1, units: [{ status: 'vacant', leases: [{ isActive: false }] }] },
    { id: 2, units: [{ status: 'occupied' }] },
    { id: 3, Units: [{ Status: 'notStarted', Leases: [{ IsActive: true }] }] },
    { id: 4, Units: [{ Status: 'overdue' }] },
    { id: 5, isOccupied: true, units: [{ status: 'draft' }] },
    { id: 6, units: [{ status: 'vacant' }, { status: 'occupied' }] },
  ];
  const sorted = dashboardPropertiesWithActiveLeasesFirst(properties);
  assert.deepEqual(sorted.map(property => property.id), [2, 4, 6, 1, 3, 5]);
  assert.deepEqual(dashboardPropertiesWithActiveLeases(properties).map(property => property.id), [2, 4, 6]);
  assert.deepEqual(properties.map(property => property.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(hasActiveLease({ id: 7 }), false);
});

test('dashboard collection includes only active-lease properties with positive expected rent', async () => {
  const { dashboardPropertiesWithExpectedRent } = await import('../src/features/properties/dashboardPropertyOrder.ts');
  const properties = [
    { id: 1, units: [{ status: 'occupied' }] },
    { id: 2, units: [{ status: 'overdue' }] },
    { id: 3, units: [{ status: 'occupied' }] },
    { id: 4, units: [{ status: 'vacant' }] },
    { Id: 5, Units: [{ Status: 'occupied' }] },
  ];
  const collections = new Map([
    ['1', { expected: 1200, collected: 0, overdue: 0 }],
    ['2', { expected: 0, collected: 0, overdue: 800 }],
    ['4', { expected: 900, collected: 0, overdue: 0 }],
    ['5', { expected: 500, collected: 500, overdue: 0 }],
  ]);
  assert.deepEqual(dashboardPropertiesWithExpectedRent(properties, collections).map(p => p.id ?? p.Id), [1, 5]);
  assert.deepEqual(properties.map(p => p.id ?? p.Id), [1, 2, 3, 4, 5]);
});

test('dashboard property collection fills the available width and height without quick actions', () => {
  assert.match(screen, /<PropertyCollectionRail[\s\S]*?<GlobalSearchModal/);
  assert.match(rail, /shell: \{ flex: 1, minHeight: 0, borderTopWidth:/);
  assert.match(rail, /collection: \{ flex: 1, minHeight: 0, paddingHorizontal:/);
  assert.doesNotMatch(rail, /width: '50%'|Quick actions|GET THINGS DONE|onAddProperty|onMaintenance|onLeases|onRent\b/);
  assert.match(rail, /<ScrollView nestedScrollEnabled[\s\S]*?refreshControl=/);
  assert.match(rail, /onProperty\(id\)/);
  assert.doesNotMatch(rail, /PROPERTIES · RENT COLLECTED|columnLabel/);
  assert.match(rail, /dashboardPropertiesWithExpectedRent\(properties\.filter.*, collections\)/);
  assert.match(rail, /No rent expected from active properties this month/);
  assert.doesNotMatch(rail, /No rent expected this month|styles\.gauge|styles\.pointer|styles\.segment/);
  assert.match(rail, /accessibilityRole="progressbar"/);
  assert.match(rail, /styles\.progressTrack[\s\S]*?styles\.progressFill/);
  assert.match(model, /currentMonthCollected/);
});
