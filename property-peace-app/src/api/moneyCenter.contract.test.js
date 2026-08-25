import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./moneyCenter.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../pages/landlord/finances.jsx', import.meta.url), 'utf8');
const header = await readFile(new URL('../sections/landlord/finances/FinancesHeader.jsx', import.meta.url), 'utf8');
const activity = await readFile(new URL('../sections/landlord/finances/ActivityTab.jsx', import.meta.url), 'utf8');
const activityRow = await readFile(new URL('../sections/landlord/finances/ActivityRow.jsx', import.meta.url), 'utf8');
const controller = await readFile(new URL('../../../property-peace-api/Controllers/MoneyCenterController.cs', import.meta.url), 'utf8');

test('Money Center client uses only the server contract endpoints', () => {
  assert.match(source, /const ROOT = ['"]\/api\/money-center['"]/);
  assert.match(source, /axiosServices\.get\(ROOT/);
  assert.match(source, /`\$\{ROOT\}\/items`/);
  assert.match(source, /`\$\{ROOT\}\/export`/);
  assert.match(source, /responseType:\s*['"]blob['"]/);
});

test('Money Center client sends contract query names', () => {
  for (const name of ['from', 'to', 'propertyId', 'unitId', 'upcomingDays']) assert.match(source, new RegExp(name));
  for (const name of ['from', 'to', 'propertyId', 'unitId', 'upcomingDays', 'limit']) assert.match(controller, new RegExp(`\\b${name}\\b`, 'i'));
});

test('export download always cleans up its temporary DOM node and object URL', () => {
  assert.match(source, /finally\s*{/);
  assert.match(source, /link\.remove\(\)/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
});

test('interactive Finances activity rows expose keyboard activation', () => {
  assert.match(activityRow, /const keyboardAction/);
  assert.match(activityRow, /role="button"/);
  assert.match(activityRow, /tabIndex={0}/);
  assert.match(activityRow, /onKeyDown/);
});

test('Activity keeps complete server export until client filters select visible-row CSV', () => {
  assert.match(page, /activeTab === 'activity' && !registeredExportState\.hasClientFilters/);
  assert.match(page, /onExport: moneyData\.exportActivity/);
  assert.match(activity, /const hasClientFilters/);
  assert.match(activity, /buildActivityCsvRows\(visibleEntries\)/);
});

test('Finances hero subtitle keeps readable contrast on the dark background', () => {
  assert.match(header, /<Typography sx={{ mt: 0\.6, color: alpha\('#fff', 0\.78\), maxWidth: 680 }}>/);
});
