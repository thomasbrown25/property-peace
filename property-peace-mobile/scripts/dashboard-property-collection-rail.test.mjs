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

test('dashboard property collection fills the available width and height without quick actions', () => {
  assert.match(screen, /<PropertyCollectionRail[\s\S]*?<GlobalSearchModal/);
  assert.match(rail, /shell: \{ flex: 1, minHeight: 0, borderTopWidth:/);
  assert.match(rail, /collection: \{ flex: 1, minHeight: 0, paddingHorizontal:/);
  assert.doesNotMatch(rail, /width: '50%'|Quick actions|GET THINGS DONE|onAddProperty|onMaintenance|onLeases|onRent\b/);
  assert.match(rail, /<ScrollView nestedScrollEnabled[\s\S]*?refreshControl=/);
  assert.match(rail, /onProperty\(id\)/);
  assert.match(rail, /PROPERTIES · RENT COLLECTED/);
  assert.match(rail, /No rent expected this month/);
  assert.match(model, /currentMonthCollected/);
});
