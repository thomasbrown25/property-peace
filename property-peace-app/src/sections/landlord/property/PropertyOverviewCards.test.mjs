import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('property actions omit inspection without removing other actions', async () => {
  const actions = await read('./PropertyQuickActionsPanel.jsx');
  assert.doesNotMatch(actions, /Schedule inspection|openScheduleInspectionDrawer|CalendarOutlined/);
  for (const label of ['Create a lease', 'View lease', 'Record payment', 'New maintenance ticket', 'Upload document']) {
    assert.match(actions, new RegExp(`label: '${label}'`));
  }
});

test('tenant, lease and desktop actions fill their shared overview grid row', async () => {
  const overview = await read('./PropertyOverview.jsx');
  const actions = await read('./PropertyQuickActionsPanel.jsx');
  assert.match(overview, /<Grid size=\{\{ xs: 12, md: 4 \}\} sx=\{\{ '& > \.MuiCard-root': \{ height: '100%' \} \}\}>\s*\{isMultiUnit/);
  assert.match(overview, /<Grid size=\{\{ xs: 12, md: 4 \}\} sx=\{\{ '& > \.MuiCard-root': \{ height: '100%' \} \}\}>\s*<PropertyActiveLease/);
  assert.match(actions, /borderRadius: 1\.5, height: '100%'/);
});
