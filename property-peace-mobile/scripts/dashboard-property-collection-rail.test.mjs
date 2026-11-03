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

test('dashboard renders a separate half-width scroll rail directly below the top navigation', () => {
  assert.match(screen, /<PropertyCollectionRail[\s\S]*?<GlobalSearchModal/);
  assert.match(rail, /width: '50%'/);
  assert.match(rail, /<ScrollView nestedScrollEnabled/);
  assert.match(rail, /onProperty\(id\)/);
  assert.match(rail, /No rent expected this month/);
  assert.match(model, /currentMonthCollected/);
});
