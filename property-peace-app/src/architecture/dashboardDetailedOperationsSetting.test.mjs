import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const home = source('../sections/landlord/dashboard/OwnerTodayHome.jsx');
const overview = source('../pages/landlord/dashboard-overview.jsx');
const appearance = source('../sections/landlord/settings/AppearanceSettings.jsx');
const config = source('../contexts/ConfigContext.jsx');

test('detailed operations are controlled from Appearance, not the dashboard home', () => {
  assert.doesNotMatch(home, /onToggleOperations|aria-controls="owner-operations"|detailed operations/);
  assert.match(appearance, /Show detailed operations/);
  assert.match(appearance, /checked=\{showDetailedOperations\}/);
  assert.match(appearance, /onChangeDetailedOperations\(event\.target\.checked\)/);
  assert.match(overview, /const \{ showDetailedOperations \} = useConfig\(\)/);
  assert.match(overview, /const operationsOpen = showDetailedOperations \|\| setupDrawerRequested/);
  assert.match(overview, /<Collapse in=\{operationsOpen\} unmountOnExit id="owner-operations">/);
});

test('preference is persisted in the existing appearance config and defaults to off', () => {
  assert.match(config, /useLocalStorage\('mantis-react-ts-config', initialState\)/);
  assert.match(config, /showDetailedOperations: false/);
  assert.match(config, /showDetailedOperations: storedConfig\.showDetailedOperations === true/);
  assert.match(config, /setConfig\(\(prev\) => \(\{ \.\.\.prev, showDetailedOperations \}\)\)/);
});
