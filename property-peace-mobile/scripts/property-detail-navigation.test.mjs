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
  assert.match(property, /<ActionRow icon="construct-outline" title=\{openRepairs === null[^\n]*navigate\('PropertyMaintenance', \{ propertyId, propertyName: details\.name \}\)/);
  assert.match(property, /titleColor=\{openRepairs !== null && openRepairs > 0/);
  assert.match(property, /icon="construct-outline"[^\n]*\n\s*<ActionRow icon="clipboard-outline" title="Checklists"/);
  assert.doesNotMatch(property, /title="Open checklists"|title="View maintenances"/);
  assert.match(navigator, /headerLeft: \(\) => <PageBackButton inHeader onPress=\{\(\) => navigation\.popToTop\(\)\}/);
  assert.match(maintenance, /setRequests\(forProperty\(data \|\| \[\], propertyId\)\)/);
});

test('shared back button has no filled background on any screen', () => {
  const button = source('components/PageBackButton.tsx');
  const navigator = source('navigation/MainNavigator.tsx');
  assert.match(button, /backgroundColor: 'transparent'/);
  assert.doesNotMatch(button, /translucent|rgba\(/);
  assert.doesNotMatch(navigator, /<PageBackButton[^>]*translucent/);
});

test('Properties tab returns to its list from a detail, including when switching from another tab', () => {
  const dock = source('navigation/QuickActionsTabBar.tsx');
  assert.match(dock, /if \(event\.defaultPrevented\) return;/);
  assert.match(dock, /if \(route\.name === 'Properties' && route\.state\?\.key\) \{\s*navigation\.dispatch\(\{ \.\.\.StackActions\.popToTop\(\), target: route\.state\.key \}\)/);
  assert.match(dock, /navigation\.navigate\('Properties', \{ screen: 'PropertiesList' \}\)/);
  assert.match(dock, /else if \(!selected\) navigation\.navigate\(route\.name\)/);
});
