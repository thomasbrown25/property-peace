import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { forProperty } from '../src/features/maintenance/propertyMaintenanceScope.ts';

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('property maintenance includes only matching requests, including API PascalCase IDs', () => {
  const requests = [{ id: 1, propertyId: 12 }, { id: 2, PropertyId: '12' }, { id: 3, propertyId: 123 }, { id: 4 }];
  assert.deepEqual(forProperty(requests, '12').map((item) => item.id), [1, 2]);
  assert.equal(forProperty(requests, '99').length, 0);
  assert.equal(forProperty(requests).length, 4);
});

test('property detail links to property-scoped maintenance and has a titled header/back to list', () => {
  const property = source('screens/landlord/PropertyDetailScreen.tsx');
  const navigator = source('navigation/MainNavigator.tsx');
  const maintenance = source('screens/landlord/MaintenanceScreen.tsx');
  assert.match(property, /navigation\.setOptions\(\{ title: details\?\.name/);
  assert.doesNotMatch(property, /<Text style=\{styles\.title\}>\{details\.name\}/);
  assert.match(property, /title="View maintenances"[\s\S]*navigate\('PropertyMaintenance', \{ propertyId, propertyName: details\.name \}\)/);
  assert.match(navigator, /headerLeft: \(\) => <PageBackButton translucent onPress=\{\(\) => navigation\.popToTop\(\)\}/);
  assert.match(maintenance, /setRequests\(forProperty\(data \|\| \[\], propertyId\)\)/);
});

test('tapping already selected Properties tab at a nested page returns to list', () => {
  const dock = source('navigation/QuickActionsTabBar.tsx');
  assert.match(dock, /selected && route\.name === 'Properties' && \(route\.state\?\.index \?\? 0\) > 0 && route\.state\?\.key/);
  assert.match(dock, /navigation\.dispatch\(\{ \.\.\.StackActions\.popToTop\(\), target: route\.state\.key \}\)/);
});
