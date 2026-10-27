import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('primary creation separates rental mode from structure and seeds property and units', async () => {
  const text = await read('./property-add-workflow.jsx');
  assert.match(text, /Which rental mode will these units use\?/);
  assert.match(text, /unitCount: initialUnitCount\(backendPropertyType, unitsToCreate\)/);
  assert.match(text, /existingUnits\.length !== unitsToCreate\.length/);
  assert.match(text, /id: seeded\.id \|\| seeded\.Id/);
  assert.match(text, /rentalMode: values\.rentalMode/);
  assert.match(text, /values\.rentalMode === 'longTerm' && rentCanInvoke/);
});

test('unit editor uses preflight, confirmation and conflict blockers instead of ordinary update', async () => {
  const text = await read('../../components/drawers/UnitEditDrawer.jsx');
  assert.match(text, /rental-mode\/preflight/);
  assert.match(text, /rental-mode`, \{ targetMode, confirmed: true \}/);
  assert.match(text, /decision\.blockers\.map/);
  assert.match(text, /response\?\.data\?\.data/);
  assert.match(text, /rentalMode\(\{ rentalMode: currentMode \|\| rentalMode\(unit\) \}\) !== 'shortTerm' && <Tab label="Tenant Management"/);
  assert.match(text, /rentalMode\(\{ rentalMode: currentMode \|\| rentalMode\(unit\) \}\) !== 'shortTerm' && <TabPanel value=\{activeTab\} index=\{2\}/);
});

test('short-term detail does not offer move-in, rent or tenant flows', async () => {
  const text = await read('../../components/drawers/UnitDetailDrawer.jsx');
  assert.match(text, /propertyModeLabel\(property\)/);
  assert.match(text, /rentalMode\(unit\) !== 'shortTerm'/);
});
