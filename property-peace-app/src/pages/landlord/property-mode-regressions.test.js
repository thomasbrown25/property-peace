import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { propertyModeLabel, rentalMode } from '../../utils/rentalMode.js';
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('alternate add URL renders the same mode-aware creation workflow', async () => {
  const routes = await read('../../routes/MainRoutes.jsx');
  assert.doesNotMatch(routes, /element: <PropertyAdd \/>/);
  assert.match(routes, /path: 'landlord\/properties\/add',\s*element: <PropertyAddWorkflow \/>/);
  assert.equal((routes.match(/path: 'landlord\/properties\/add'/g) || []).length, 1);
});

test('single-home lease actions are shown only for long-term units and mixed table shows per-unit mode', async () => {
  const page = await read('./property.jsx');
  assert.match(page, /property\?\.propertyType !== 'multiUnit' && rentalMode\(property\?\.units\?\.\[0\]\) !== 'shortTerm' && \(/);
  assert.match(page, /<TableCell>Rental mode<\/TableCell>/);
  assert.match(page, /label=\{modeLabel\(unit\)\}/);
  assert.match(page, /rentalMode\(unit\) === 'shortTerm' \? \(/);
  assert.match(page, /View Lease/);
  assert.match(page, /Add Lease/);
  assert.match(page, /const longTermUnits = .*\.filter\(unit => rentalMode\(unit\) !== 'shortTerm'\)/);
  assert.match(page, /units=\{longTermUnits\}/);
  assert.match(page, /new URLSearchParams\(\{ propertyId: String\(property.id\), unitId: String\(unit.id\) \}\)/);
  const overview = await read('../../sections/landlord/property/PropertyOverview.jsx');
  const actions = await read('../../sections/landlord/property/PropertyQuickActionsPanel.jsx');
  assert.match(overview, /longTermUnits\.length > 0 && <PropertyActiveLease/);
  assert.match(overview, /units=\{longTermUnits\}/);
  assert.match(actions, /hasLongTermUnits \? \[leaseAction\] : \[\]/);
  assert.match(actions, /units\.filter\(unit => rentalMode\(unit\) !== 'shortTerm'\)/);
  assert.equal(propertyModeLabel({ units: [{ rentalMode: 'shortTerm' }, { rentalMode: 'longTerm' }] }), 'Mixed');
  assert.equal(rentalMode({}), 'longTerm');
});

test('editor resets mode and tab on reopen or unit mode change, never stranding a hidden tab', async () => {
  const editor = await read('../../components/drawers/UnitEditDrawer.jsx');
  assert.match(editor, /\[drawer\.isOpenUnitEdit, unit\?\.id\]/);
  assert.match(editor, /setActiveTab\(0\);\s*setCurrentMode\(targetMode\)/);
  assert.match(editor, /currentMode \|\| rentalMode\(unit\)/);
});
