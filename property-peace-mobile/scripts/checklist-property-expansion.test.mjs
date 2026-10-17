import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = () => readFileSync(new URL('../src/screens/landlord/ChecklistPropertySearchScreen.tsx', import.meta.url), 'utf8');

test('multi-unit tap expands or collapses inline while single-unit tap navigates directly', () => {
  const screen = source();
  assert.match(screen, /if \(isMultiUnitProperty\(property\)\)\s*\{[\s\S]*?setSelectedProperty\(\(current\) =>[\s\S]*?propertyId\(current\) === propertyId\(property\) \? null : property/);
  assert.match(screen, /else\s*\{\s*navigation\.navigate\('PropertyChecklists', buildChecklistHomeParams\(property\)\)/);
  assert.match(screen, /LayoutAnimation\.configureNext/);
});

test('expanded units and their loading and error states render inside the property row, not in the list footer', () => {
  const screen = source();
  const row = screen.slice(screen.indexOf('renderItem={({ item }) =>'), screen.indexOf('ItemSeparatorComponent='));
  assert.match(row, /selected\s*&&\s*needsUnit/);
  assert.match(row, /displayedUnits\.map\(\(unit\)/);
  assert.match(row, /unitsForPropertyId === propertyId\(item\) \? units : \[\]/);
  assert.match(row, /waitingForUnits/);
  assert.match(row, /unitsError/);
  assert.match(row, /buildChecklistHomeParams\(item, unit\)/);
  assert.match(row, /buildPropertyChecklistHistoryEntry\(item\)/);
  const footer = screen.slice(screen.indexOf('ListFooterComponent='), screen.indexOf('\n    />', screen.indexOf('ListFooterComponent=')));
  assert.doesNotMatch(footer, /units\.map|unitCard|continueButton/);
});
